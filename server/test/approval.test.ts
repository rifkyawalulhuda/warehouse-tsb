import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import { computeApprovalDeadline, needsApproval } from '../src/modules/bookings/repository'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let truckTypeId: number
let adminCookie: string
let customerCookie: string
let customer2Cookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
  })
  truckTypeId = seeded.truckTypes[0]!.id

  adminCookie = await loginCookie(app, 'admin@test.local')
  customerCookie = await loginCookie(app, 'customer1@test.local')
  customer2Cookie = await loginCookie(app, 'customer2@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

function payload(overrides: Record<string, unknown> = {}) {
  return {
    bookingDate: TOMORROW(),
    activityType: 'UNLOADING',
    truckTypeId,
    startMinute: 9 * 60,
    referenceDocNo: 'DO-APPROVAL-001',
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
  return response.body.data
}

/* ------------------------------------------------------------------ */
/* Aturan murni                                                        */
/* ------------------------------------------------------------------ */

describe('needsApproval', () => {
  it('tidak pernah butuh approval saat mode AUTO', () => {
    expect(
      needsApproval({ approvalMode: 'AUTO', role: 'CUSTOMER', autoApproveBooking: false })
    ).toBe(false)
  })

  it('customer non-whitelist butuh approval saat mode MANUAL', () => {
    expect(
      needsApproval({ approvalMode: 'MANUAL', role: 'CUSTOMER', autoApproveBooking: false })
    ).toBe(true)
  })

  it('customer whitelist tidak butuh approval', () => {
    expect(
      needsApproval({ approvalMode: 'MANUAL', role: 'CUSTOMER', autoApproveBooking: true })
    ).toBe(false)
  })

  it('admin tidak pernah masuk antrean', () => {
    expect(
      needsApproval({ approvalMode: 'MANUAL', role: 'ADMIN', autoApproveBooking: false })
    ).toBe(false)
  })
})

describe('computeApprovalDeadline', () => {
  it('memakai startTime - lead bila booking dibuat jauh sebelumnya', () => {
    const startTime = new Date('2030-01-10T01:00:00.000Z')
    const createdAt = new Date('2030-01-05T01:00:00.000Z')

    const deadline = computeApprovalDeadline({
      startTime,
      createdAt,
      leadMinutes: 30,
      minDecisionMinutes: 15,
    })

    // startTime - 30 menit lebih lambat dari createdAt + 15 menit -> menang.
    expect(deadline.toISOString()).toBe('2030-01-10T00:30:00.000Z')
  })

  it('memakai createdAt + minDecision untuk booking mendesak (MAX, bukan MIN)', () => {
    const startTime = new Date('2030-01-10T01:00:00.000Z')
    // Dibuat 10 menit sebelum jadwal; startTime - 30 menit sudah lewat.
    const createdAt = new Date('2030-01-10T00:50:00.000Z')

    const deadline = computeApprovalDeadline({
      startTime,
      createdAt,
      leadMinutes: 30,
      minDecisionMinutes: 15,
    })

    // createdAt + 15 menit = 01:05, yaitu SETELAH startTime. Disengaja:
    // Admin selalu punya jendela keputusan minimum.
    expect(deadline.toISOString()).toBe('2030-01-10T01:05:00.000Z')
    expect(deadline.getTime()).toBeGreaterThan(startTime.getTime())
  })
})

/* ------------------------------------------------------------------ */
/* End-to-end lewat API                                                */
/* ------------------------------------------------------------------ */

describe('POST /api/bookings dengan kebijakan approval', () => {
  it('mode AUTO menghasilkan NOT_REQUIRED tanpa tenggat', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())

    expect(response.status).toBe(201)
    expect(response.body.data.approvalStatus).toBe('NOT_REQUIRED')
    expect(response.body.data.approvalDeadline).toBeNull()
  })

  it('mode MANUAL membuat booking customer non-whitelist menjadi PENDING', async () => {
    await setMode('MANUAL')

    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())

    expect(response.status).toBe(201)
    expect(response.body.data.approvalStatus).toBe('PENDING')
    expect(response.body.data.approvalDeadline).not.toBeNull()
  })

  it('mode MANUAL tidak menahan booking customer yang di-whitelist', async () => {
    await setMode('MANUAL')

    const users = await prisma.user.findMany({
      where: { email: 'customer1@test.local' },
      select: { id: true },
    })
    await prisma.user.update({
      where: { id: users[0]!.id },
      data: { autoApproveBooking: true },
    })

    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())

    expect(response.status).toBe(201)
    expect(response.body.data.approvalStatus).toBe('NOT_REQUIRED')
  })

  it('booking baru tetap menggenggam kuota walau PENDING', async () => {
    await setMode('MANUAL')

    await request(app).post('/api/bookings').set('Cookie', customerCookie).send(payload())

    // Kapasitas 2. Booking PENDING sudah memakai 1, jadi tersisa 1.
    const availability = await request(app)
      .get('/api/bookings/slots/availability')
      .query({ date: TOMORROW(), activity: 'UNLOADING', truckTypeId })
      .set('Cookie', customerCookie)

    expect(availability.status).toBe(200)
    const slot = availability.body.data.slots.find(
      (item: { startMinute: number }) => item.startMinute === 9 * 60
    )
    expect(slot.remaining).toBe(1)
  })
})

describe('GET /api/approvals', () => {
  async function createPending() {
    await setMode('MANUAL')
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    expect(response.status).toBe(201)
    return response.body.data
  }

  it('menampilkan booking PENDING untuk Admin', async () => {
    const booking = await createPending()

    const response = await request(app)
      .get('/api/approvals')
      .set('Cookie', adminCookie)

    expect(response.status).toBe(200)
    expect(response.body.data.bookings.map((b: { id: string }) => b.id)).toContain(booking.id)
  })

  it('menolak customer biasa', async () => {
    const response = await request(app)
      .get('/api/approvals')
      .set('Cookie', customerCookie)

    expect(response.status).toBe(403)
  })

  it('mengizinkan non-ADMIN yang diberi flag canApproveBooking', async () => {
    const gate = await prisma.user.findUnique({ where: { email: 'gate@test.local' } })
    await prisma.user.update({
      where: { id: gate!.id },
      data: { canApproveBooking: true },
    })
    const gateCookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app).get('/api/approvals').set('Cookie', gateCookie)

    expect(response.status).toBe(200)
  })
})

describe('POST /api/approvals/:id/approve', () => {
  async function createPending() {
    await setMode('MANUAL')
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    return response.body.data
  }

  it('menyetujui booking dan mencatat approver', async () => {
    const booking = await createPending()

    const response = await request(app)
      .post(`/api/approvals/${booking.id}/approve`)
      .set('Cookie', adminCookie)

    expect(response.status).toBe(200)
    expect(response.body.data.approvalStatus).toBe('APPROVED')
    expect(response.body.data.approvedAt).not.toBeNull()

    const audit = await prisma.auditLog.findFirst({
      where: { bookingId: booking.id, action: 'BOOKING_APPROVED' },
    })
    expect(audit).not.toBeNull()
  })

  it('menolak approve kedua kali', async () => {
    const booking = await createPending()

    const first = await request(app)
      .post(`/api/approvals/${booking.id}/approve`)
      .set('Cookie', adminCookie)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post(`/api/approvals/${booking.id}/approve`)
      .set('Cookie', adminCookie)
    expect(second.status).toBe(409)
    expect(second.body.error?.code ?? second.body.code).toBe('APPROVAL_ALREADY_DECIDED')
  })
})

describe('POST /api/approvals/:id/reject', () => {
  async function createPending() {
    await setMode('MANUAL')
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload())
    return response.body.data
  }

  it('menolak tanpa alasan', async () => {
    const booking = await createPending()

    const response = await request(app)
      .post(`/api/approvals/${booking.id}/reject`)
      .set('Cookie', adminCookie)
      .send({})

    expect(response.status).toBe(400)
  })

  it('menolak dengan alasan, membatalkan booking, dan melepas kuota', async () => {
    const booking = await createPending()

    const before = await prisma.slotAllocation.findMany({
      where: { activity: 'UNLOADING' },
      orderBy: { slotStartMinute: 'asc' },
    })
    expect(before.some((row) => row.used > 0)).toBe(true)

    const response = await request(app)
      .post(`/api/approvals/${booking.id}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Dokumen tidak lengkap' })

    expect(response.status).toBe(200)
    expect(response.body.data.approvalStatus).toBe('REJECTED')
    expect(response.body.data.status).toBe('CANCELLED')
    expect(response.body.data.rejectionReason).toBe('Dokumen tidak lengkap')

    const after = await prisma.slotAllocation.findMany({
      where: { activity: 'UNLOADING' },
      orderBy: { slotStartMinute: 'asc' },
    })
    expect(after.every((row) => row.used === 0)).toBe(true)
  })

  it('mengizinkan customer booking lagi setelah ditolak', async () => {
    const booking = await createPending()
    await request(app)
      .post(`/api/approvals/${booking.id}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Dokumen tidak lengkap' })

    const retry = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload({ referenceDocNo: 'DO-APPROVAL-002' }))

    expect(retry.status).toBe(201)
    expect(retry.body.data.approvalStatus).toBe('PENDING')
  })
})

describe('POST /api/approvals/batch-approve', () => {
  it('melaporkan item yang sudah diputuskan tanpa menggagalkan sisanya', async () => {
    await setMode('MANUAL')

    const first = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send(payload({ referenceDocNo: 'DO-BATCH-1', startMinute: 9 * 60 }))
    const second = await request(app)
      .post('/api/bookings')
      .set('Cookie', customer2Cookie)
      .send(payload({ referenceDocNo: 'DO-BATCH-2', startMinute: 10 * 60 }))

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)

    // Putuskan yang pertama lebih dulu agar batch menemukannya bukan PENDING.
    await request(app)
      .post(`/api/approvals/${first.body.data.id}/approve`)
      .set('Cookie', adminCookie)

    const response = await request(app)
      .post('/api/approvals/batch-approve')
      .set('Cookie', adminCookie)
      .send({ ids: [first.body.data.id, second.body.data.id] })

    expect(response.status).toBe(200)
    expect(response.body.data.approved).toEqual([second.body.data.id])
    expect(response.body.data.skipped).toEqual([
      { id: first.body.data.id, reason: 'ALREADY_DECIDED' },
    ])
  })
})
