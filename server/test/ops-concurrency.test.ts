import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import type { BookingStatus } from '@prisma/client'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc, utcToDateOnly } from '../src/lib/time'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await resetDatabase(prisma)
})

/**
 * Satu booking siap aksi, tanpa lewat API.
 *
 * Aksi ops diuji dari keadaan yang sudah pasti (mis. sudah gate-in), karena
 * yang diperiksa di sini bukan alur pembuatan booking melainkan apakah dua
 * petugas yang menekan tombol bersamaan menghasilkan satu perubahan atau dua.
 */
async function seedBooking(options: {
  seed: Awaited<ReturnType<typeof seedBase>>
  status: BookingStatus
  startTime?: Date
  dockId?: number
}) {
  const { seed } = options
  const startTime = options.startTime ?? new Date(Date.now() + 5 * 60_000)

  const booking = await prisma.booking.create({
    data: {
      bookingCode: `TSB-20261111-${String(Math.floor(Math.random() * 900) + 100)}`,
      referenceDocNo: 'REF-OPS',
      qrToken: `OpsToken${Math.random().toString(36).slice(2, 14)}`,
      customerId: seed.customerA.id,
      createdById: seed.customer.id,
      activityType: 'UNLOADING',
      truckTypeId: seed.truckTypes[0]!.id,
      bookingDate: dateOnlyToUtc(utcToDateOnly(startTime)),
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: options.status,
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
      assignedDockId: options.dockId ?? null,
    },
  })

  if (options.dockId) {
    await prisma.dock.update({
      where: { id: options.dockId },
      data: { currentStatus: 'OCCUPIED' },
    })
  }

  return booking
}

describe('konkurensi aksi ops', () => {
  it('gate-in ganda hanya menghasilkan satu kedatangan', async () => {
    const seed = await seedBase(prisma)
    const booking = await seedBooking({ seed, status: 'BOOKED_READY' })
    const cookie = await loginCookie(app, 'gate@test.local')

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app).post('/api/ops/gate-in').set('Cookie', cookie).send({ qrToken: booking.qrToken })
      )
    )

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409, 409])

    const logs = await prisma.bookingTimeLog.findMany({ where: { bookingId: booking.id } })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.gateInAt).not.toBeNull()

    const audits = await prisma.auditLog.count({
      where: { bookingId: booking.id, action: 'GATE_IN' },
    })
    expect(audits).toBe(1)
  })

  it('menyelesaikan proses dua kali hanya mencatat satu penyelesaian', async () => {
    const seed = await seedBase(prisma)
    const booking = await seedBooking({
      seed,
      status: 'IN_PROGRESS',
      dockId: seed.docks[0]!.id,
    })
    await prisma.bookingTimeLog.create({
      data: { bookingId: booking.id, processStartedAt: new Date() },
    })
    const cookie = await loginCookie(app, 'checker@test.local')

    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app)
          .post('/api/ops/finish-process')
          .set('Cookie', cookie)
          .send({ bookingId: booking.id })
      )
    )

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409, 409])

    const audits = await prisma.auditLog.count({
      where: { bookingId: booking.id, action: 'PROCESS_COMPLETED' },
    })
    expect(audits).toBe(1)

    const dock = await prisma.dock.findUniqueOrThrow({ where: { id: seed.docks[0]!.id } })
    expect(dock.currentStatus).toBe('AVAILABLE')
  })

  it('dua penugasan dock bersamaan tidak meninggalkan dock terkunci', async () => {
    const seed = await seedBase(prisma, { docks: activityDocks(2, 'UNLOADING') })
    const booking = await seedBooking({ seed, status: 'CHECKED_IN_ON_TIME' })
    const cookie = await loginCookie(app, 'checker@test.local')

    const [first, second] = await Promise.all(
      seed.docks.slice(0, 2).map((dock) =>
        request(app)
          .post('/api/ops/assign-dock')
          .set('Cookie', cookie)
          .send({ bookingId: booking.id, dockId: dock.id })
      )
    )

    expect([first.status, second.status].sort()).toEqual([200, 409])

    const docks = await prisma.dock.findMany({ orderBy: { id: 'asc' } })
    expect(docks.filter((dock) => dock.currentStatus === 'OCCUPIED')).toHaveLength(1)

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    const occupied = docks.find((dock) => dock.currentStatus === 'OCCUPIED')!
    expect(saved.assignedDockId).toBe(occupied.id)
  })

  it('pelepasan dock dan penyelesaian proses tidak saling menimpa', async () => {
    const seed = await seedBase(prisma)
    const booking = await seedBooking({
      seed,
      status: 'DOCK_ASSIGNED',
      dockId: seed.docks[0]!.id,
    })
    await prisma.bookingTimeLog.create({
      data: { bookingId: booking.id, gateInAt: new Date(), dockAssignedAt: new Date() },
    })
    const cookie = await loginCookie(app, 'checker@test.local')

    const [unassign, finish] = await Promise.all([
      request(app)
        .post('/api/ops/unassign-dock')
        .set('Cookie', cookie)
        .send({ bookingId: booking.id }),
      request(app)
        .post('/api/ops/finish-process')
        .set('Cookie', cookie)
        .send({ bookingId: booking.id }),
    ])

    expect([unassign.status, finish.status].sort()).toEqual([200, 409])

    // Pemenang menentukan hasil akhir; yang kalah tidak boleh meninggalkan jejak.
    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    const completed = await prisma.auditLog.count({
      where: { bookingId: booking.id, action: 'PROCESS_COMPLETED' },
    })
    const unassigned = await prisma.auditLog.count({
      where: { bookingId: booking.id, action: 'DOCK_UNASSIGNED' },
    })

    expect(completed + unassigned).toBe(1)
    expect(saved.status).toBe(completed === 1 ? 'COMPLETED' : 'CHECKED_IN_ON_TIME')

    const dock = await prisma.dock.findUniqueOrThrow({ where: { id: seed.docks[0]!.id } })
    expect(dock.currentStatus).toBe('AVAILABLE')
  })
})
