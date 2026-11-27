import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { dateOnlyToUtc, jakartaInstant, todayISO, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

/**
 * Dua penolakan di `POST /api/ops/assign-dock` yang belum pernah diuji:
 * dock yang sedang dirawat dan dock yang tidak melayani aktivitas booking.
 *
 * Keduanya penting karena UI hanya menyembunyikan dock yang tidak cocok —
 * permintaan bisa tetap datang dari tab yang sudah lama terbuka, dan tanpa
 * penjagaan di server truk LOADING bisa masuk ke dock UNLOADING.
 */
const prisma = new PrismaClient()
const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function seed() {
  const seeded = await seedBase(prisma, {
    docks: [
      { dockCode: 'D1', allowedActivity: 'UNLOADING' },
      { dockCode: 'D2', allowedActivity: 'BOTH' },
      { dockCode: 'D3', allowedActivity: 'UNLOADING' },
    ],
  })
  const checker = await loginCookie(app, 'checker@test.local')
  return { seeded, checker }
}

async function seedBooking(
  customerId: string,
  truckTypeId: number,
  activityType: 'LOADING' | 'UNLOADING'
) {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
  const start = jakartaInstant(todayISO(), 9 * 60)
  return prisma.booking.create({
    data: {
      bookingCode: `T-${Math.random().toString(36).slice(2, 8)}`,
      referenceDocNo: 'REF-TEST',
      qrToken: Math.random().toString(36).slice(2).padEnd(32, '0'),
      customerId,
      createdById: admin.id,
      activityType,
      truckTypeId,
      bookingDate: dateOnlyToUtc(utcToDateOnly(start)),
      startTime: start,
      endTime: new Date(start.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: 'CHECKED_IN_ON_TIME',
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

describe('POST /api/ops/assign-dock - aturan dock', () => {
  it('menolak DOCK_ACTIVITY_MISMATCH dan tidak mengunci dock', async () => {
    const { seeded, checker } = await seed()
    const booking = await seedBooking(seeded.customerA.id, seeded.truckTypes[0]!.id, 'LOADING')
    const unloadingDock = seeded.docks.find((dock) => dock.dockCode === 'D1')!

    const response = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checker)
      .send({ bookingId: booking.id, dockId: unloadingDock.id })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('DOCK_ACTIVITY_MISMATCH')

    const dock = await prisma.dock.findUniqueOrThrow({ where: { id: unloadingDock.id } })
    expect(dock.currentStatus).toBe('AVAILABLE')

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.assignedDockId).toBeNull()
  })

  it('menerima dock BOTH untuk aktivitas apa pun', async () => {
    const { seeded, checker } = await seed()
    const booking = await seedBooking(seeded.customerA.id, seeded.truckTypes[0]!.id, 'LOADING')
    const bothDock = seeded.docks.find((dock) => dock.dockCode === 'D2')!

    const response = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checker)
      .send({ bookingId: booking.id, dockId: bothDock.id })

    expect(response.status).toBe(200)
  })

  it('menolak DOCK_MAINTENANCE dan tidak menugaskan apa pun', async () => {
    const { seeded, checker } = await seed()
    const booking = await seedBooking(seeded.customerA.id, seeded.truckTypes[0]!.id, 'UNLOADING')
    const maintenance = seeded.docks.find((dock) => dock.dockCode === 'D3')!
    await prisma.dock.update({
      where: { id: maintenance.id },
      data: { currentStatus: 'MAINTENANCE' },
    })

    const response = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checker)
      .send({ bookingId: booking.id, dockId: maintenance.id })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('DOCK_MAINTENANCE')

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.assignedDockId).toBeNull()
  })
})
