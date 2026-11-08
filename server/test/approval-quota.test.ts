import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { prisma as sharedPrisma } from '../src/lib/prisma'
import { addDaysISO, dateOnlyToUtc, jakartaInstant, todayISO } from '../src/lib/time'
import { getSettings, toWindow, capacityForActivity } from '../src/lib/settings'
import { reserveBlocks, finalizeRelease } from '../src/modules/bookings/quota-service'
import { expirePendingApprovals } from '../src/jobs/approval-expiry'
import { markNoShowBookings } from '../src/jobs/no-show'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let truckTypeId: number
let adminCookie: string
let customerCookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
  })
  truckTypeId = seeded.truckTypes[0]!.id
  adminCookie = await loginCookie(app, 'admin@test.local')
  customerCookie = await loginCookie(app, 'customer1@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
  await sharedPrisma.$disconnect()
})

function payload(overrides: Record<string, unknown> = {}) {
  return {
    bookingDate: TOMORROW(),
    activityType: 'UNLOADING',
    truckTypeId,
    startMinute: 9 * 60,
    referenceDocNo: 'DO-QUOTA-001',
    licensePlate: 'B 1234 XYZ',
    driverName: 'Supir Tes',
    ...overrides,
  }
}

async function setMode(mode: 'AUTO' | 'MANUAL') {
  const response = await request(app)
    .put('/api/settings')
    .set('Cookie', adminCookie)
    .send({ approvalMode: mode })
  expect(response.status).toBe(200)
}

async function usedByBlock(): Promise<number> {
  const rows = await prisma.slotAllocation.findMany({
    where: { activity: 'UNLOADING' },
    orderBy: { slotStartMinute: 'asc' },
  })
  return rows.reduce((sum, row) => sum + row.used, 0)
}

describe('kuota booking PENDING', () => {
  it('expire melepas kuota tepat satu kali', async () => {
    await setMode('MANUAL')

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    expect(created.status).toBe(201)

    const usedWhilePending = await usedByBlock()
    expect(usedWhilePending).toBe(2) // dua blok, masing-masing +1

    // Tenggat dipaksa lewat supaya job menganggapnya kedaluwarsa.
    await prisma.booking.update({
      where: { id: created.body.data.id },
      data: { approvalDeadline: new Date(Date.now() - 60_000) },
    })

    const expired = await expirePendingApprovals()
    expect(expired).toBe(1)
    expect(await usedByBlock()).toBe(0)

    const booking = await prisma.booking.findUnique({ where: { id: created.body.data.id } })
    expect(booking?.approvalStatus).toBe('EXPIRED')
    expect(booking?.status).toBe('CANCELLED')
    expect(booking?.quotaReleasedAt).not.toBeNull()
  })

  it('expire tidak menyentuh booking yang sudah disetujui', async () => {
    await setMode('MANUAL')

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())

    await request(app)
      .post(`/api/approvals/${created.body.data.id}/approve`)
      .set('Cookie', adminCookie)

    await prisma.booking.update({
      where: { id: created.body.data.id },
      data: { approvalDeadline: new Date(Date.now() - 60_000) },
    })

    const expired = await expirePendingApprovals()
    expect(expired).toBe(0)
    expect(await usedByBlock()).toBe(2) // kuota tetap tergenggam
  })

  it('membatalkan lalu expire tidak melepas kuota dua kali', async () => {
    await setMode('MANUAL')

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    const id = created.body.data.id

    const cancel = await request(app)
      .post(`/api/bookings/${id}/cancel`)
      .set('Cookie', customerCookie)
    expect(cancel.status).toBe(200)
    expect(await usedByBlock()).toBe(0)

    await prisma.booking.update({
      where: { id },
      data: { approvalDeadline: new Date(Date.now() - 60_000) },
    })

    await expirePendingApprovals()

    // Kalau guard bocor, used akan jadi negatif dan GREATEST(0) menyembunyikannya.
    expect(await usedByBlock()).toBe(0)
    const booking = await prisma.booking.findUnique({ where: { id } })
    expect(booking?.quotaReleasedAt).not.toBeNull()
  })

  it('job NO_SHOW tidak menyentuh booking PENDING', async () => {
    await setMode('MANUAL')

    // Booking untuk kemarin, masih PENDING dan tenggatnya belum lewat.
    const yesterday = addDaysISO(todayISO(), -1)
    const created = await prisma.booking.create({
      data: {
        bookingCode: 'TSB-PENDING-001',
        qrToken: 'qr-pending-0000000000000000000001',
        referenceDocNo: 'DO-PENDING',
        customerId: (await prisma.user.findUnique({ where: { email: 'customer1@test.local' } }))!.id,
        activityType: 'UNLOADING',
        truckTypeId,
        bookingDate: dateOnlyToUtc(yesterday),
        startTime: jakartaInstant(yesterday, 9 * 60),
        endTime: jakartaInstant(yesterday, 10 * 60),
        blocksLocked: 2,
        status: 'BOOKED_READY',
        approvalStatus: 'PENDING',
        approvalDeadline: new Date(Date.now() + 3_600_000),
        licensePlate: 'B 9999 PP',
        driverName: 'Supir Pending',
      },
    })

    await markNoShowBookings()

    const after = await prisma.booking.findUnique({ where: { id: created.id } })
    expect(after?.status).toBe('BOOKED_READY')
    expect(after?.approvalStatus).toBe('PENDING')
  })

  it('reject melepas kuota walau booking sudah sempat menahan slot', async () => {
    await setMode('MANUAL')

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    expect(await usedByBlock()).toBe(2)

    const rejected = await request(app)
      .post(`/api/approvals/${created.body.data.id}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Jadwal bentrok' })

    expect(rejected.status).toBe(200)
    expect(await usedByBlock()).toBe(0)
  })
})

describe('finalizeRelease', () => {
  it('mengembalikan false pada pemanggilan kedua', async () => {
    const settings = await getSettings()
    const window = toWindow(settings)
    const capacity = await capacityForActivity('UNLOADING')
    const customer = await prisma.user.findUnique({
      where: { email: 'customer1@test.local' },
    })
    const date = TOMORROW()

    const booking = await prisma.$transaction(async (tx) => {
      await reserveBlocks(
        tx,
        { date, activity: 'UNLOADING', window, capacity },
        9 * 60,
        2
      )
      return tx.booking.create({
        data: {
          bookingCode: 'TSB-REL-001',
          qrToken: 'qr-release-000000000000000000001',
          referenceDocNo: 'DO-REL',
          customerId: customer!.id,
          activityType: 'UNLOADING',
          truckTypeId,
          bookingDate: dateOnlyToUtc(date),
          startTime: jakartaInstant(date, 9 * 60),
          endTime: jakartaInstant(date, 10 * 60),
          blocksLocked: 2,
          status: 'BOOKED_READY',
        },
      })
    })

    const params = {
      bookingId: booking.id,
      date,
      activity: 'UNLOADING' as const,
      startMinute: 9 * 60,
      blocksRequired: 2,
      window,
    }

    const first = await prisma.$transaction((tx) => finalizeRelease(tx, params))
    const second = await prisma.$transaction((tx) => finalizeRelease(tx, params))

    expect(first).toBe(true)
    expect(second).toBe(false)

    // Hanya turun sekali; tidak negatif.
    const rows = await prisma.slotAllocation.findMany({ where: { activity: 'UNLOADING' } })
    expect(rows.every((row) => row.used === 0)).toBe(true)
  })
})

describe('KPI expiredPending', () => {
  it('menghitung booking yang kedaluwarsa secara terpisah dari pembatalan biasa', async () => {
    await setMode('MANUAL')

    const expiredBooking = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload({ referenceDocNo: 'DO-KPI-1' }))

    await prisma.booking.update({
      where: { id: expiredBooking.body.data.id },
      data: { approvalDeadline: new Date(Date.now() - 60_000) },
    })
    await expirePendingApprovals()

    const normalCancel = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload({ referenceDocNo: 'DO-KPI-2', startMinute: 10 * 60 }))
    await request(app)
      .post(`/api/bookings/${normalCancel.body.data.id}/cancel`)
      .set('Cookie', customerCookie)

    const report = await request(app)
      .get('/api/reports/kpi')
      .query({ from: TOMORROW(), to: TOMORROW() })
      .set('Cookie', adminCookie)

    expect(report.status).toBe(200)
    expect(report.body.data.kpi.expiredPending).toBe(1)
    expect(report.body.data.kpi.cancelled).toBe(2)
  })
})

describe('gate-in diblokir saat PENDING', () => {
  it('scan menandai approvalPending dan gate-in menolak', async () => {
    await setMode('MANUAL')

    // Booking hari ini, satu jam dari sekarang agar tidak kena batas datang awal.
    const date = todayISO()
    const now = new Date()
    const startMinute = Math.min(
      16 * 60,
      Math.max(9 * 60 + 30, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30 + 60)
    )

    const created = await prisma.booking.create({
      data: {
        bookingCode: 'TSB-GATE-001',
        qrToken: 'qr-gate-00000000000000000000001',
        referenceDocNo: 'DO-GATE',
        customerId: (await prisma.user.findUnique({ where: { email: 'customer1@test.local' } }))!.id,
        activityType: 'UNLOADING',
        truckTypeId,
        bookingDate: dateOnlyToUtc(date),
        startTime: jakartaInstant(date, startMinute),
        endTime: jakartaInstant(date, startMinute + 60),
        blocksLocked: 2,
        status: 'BOOKED_READY',
        approvalStatus: 'PENDING',
        approvalDeadline: new Date(Date.now() + 3_600_000),
        licensePlate: 'B 7777 GG',
        driverName: 'Supir Gate',
      },
    })

    const gateCookie = await loginCookie(app, 'gate@test.local')

    const scan = await request(app)
      .get(`/api/ops/scan/${created.qrToken}`)
      .set('Cookie', gateCookie)

    expect(scan.status).toBe(200)
    expect(scan.body.data.approvalPending).toBe(true)
    expect(scan.body.data.canGateIn).toBe(false)

    const gateIn = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: created.qrToken })

    expect(gateIn.status).toBe(409)
    expect(gateIn.body.error?.code ?? gateIn.body.code).toBe('APPROVAL_PENDING')
  })
})
