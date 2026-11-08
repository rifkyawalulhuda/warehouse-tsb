import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import { activityDocks, loginCookie, resetDatabase, seedBase, TEST_PASSWORD } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let truckTypeId: number
let adminCookie: string
let customerCookie: string
let customer2Cookie: string
let alphaId: string
let betaId: string
let mateCookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
  })
  truckTypeId = seeded.truckTypes[0]!.id
  alphaId = seeded.customerA.id
  betaId = seeded.customerB.id

  adminCookie = await loginCookie(app, 'admin@test.local')
  customerCookie = await loginCookie(app, 'customer1@test.local')
  customer2Cookie = await loginCookie(app, 'customer2@test.local')

  // Rekan seperusahaan: akun kedua di PT Alpha.
  await prisma.user.create({
    data: {
      name: 'Rekan Alpha',
      email: 'rekan.alpha@test.local',
      role: 'CUSTOMER',
      customerId: alphaId,
      passwordHash: (
        await prisma.user.findUniqueOrThrow({ where: { email: 'customer1@test.local' } })
      ).passwordHash,
    },
  })
  mateCookie = await loginCookie(app, 'rekan.alpha@test.local')
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
    referenceDocNo: 'DO-OWN-001',
    licensePlate: 'B 1234 XYZ',
    driverName: 'Supir Tes',
    ...overrides,
  }
}

async function createBooking(cookie: string, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post('/api/bookings')
    .set('Cookie', cookie)
    .send(payload(overrides))
  expect(response.status).toBe(201)
  return response.body.data as { id: string; customer: { id: string }; createdBy: { id: string } }
}

describe('kepemilikan booking per perusahaan', () => {
  it('booking mencatat perusahaan sebagai pemilik dan akun sebagai pembuat', async () => {
    const booking = await createBooking(customerCookie)

    expect(booking.customer.id).toBe(alphaId)
    expect(booking.createdBy.id).not.toBe(booking.customer.id)
  })

  it('rekan seperusahaan melihat booking yang dibuat rekannya di my-list', async () => {
    await createBooking(customerCookie)

    const mine = await request(app).get('/api/bookings/my-list').set('Cookie', mateCookie)
    expect(mine.status).toBe(200)
    expect(mine.body.data).toHaveLength(1)
    expect(mine.body.data[0].customer.id).toBe(alphaId)
  })

  it('rekan seperusahaan boleh membuka detail booking rekannya', async () => {
    const booking = await createBooking(customerCookie)

    const detail = await request(app)
      .get(`/api/bookings/${booking.id}`)
      .set('Cookie', mateCookie)

    expect(detail.status).toBe(200)
    expect(detail.body.data.id).toBe(booking.id)
  })

  it('rekan seperusahaan boleh membatalkan booking rekannya', async () => {
    const booking = await createBooking(customerCookie)

    const cancelled = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Cookie', mateCookie)

    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
  })

  it('customer perusahaan lain tidak bisa melihat detail', async () => {
    const booking = await createBooking(customerCookie)

    const detail = await request(app)
      .get(`/api/bookings/${booking.id}`)
      .set('Cookie', customer2Cookie)

    expect(detail.status).toBe(403)
  })

  it('customer perusahaan lain tidak bisa membatalkan', async () => {
    const booking = await createBooking(customerCookie)

    const cancelled = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Cookie', customer2Cookie)

    expect(cancelled.status).toBe(403)
  })

  it('my-list tidak membocorkan booking perusahaan lain', async () => {
    await createBooking(customerCookie)
    await createBooking(customer2Cookie, {
      startMinute: 11 * 60,
      referenceDocNo: 'DO-BETA',
    })

    const betaList = await request(app)
      .get('/api/bookings/my-list')
      .set('Cookie', customer2Cookie)

    expect(betaList.status).toBe(200)
    expect(betaList.body.data).toHaveLength(1)
    expect(betaList.body.data[0].customer.id).toBe(betaId)
  })
})

describe('whitelist approval milik perusahaan', () => {
  async function setManual() {
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', adminCookie)
      .send({ approvalMode: 'MANUAL' })
    expect(response.status).toBe(200)
  }

  it('satu flag customer berlaku untuk semua akun perusahaannya', async () => {
    await setManual()
    await prisma.customer.update({
      where: { id: alphaId },
      data: { autoApproveBooking: true },
    })

    const byOwner = await createBooking(customerCookie)
    const byMate = await createBooking(mateCookie, {
      startMinute: 12 * 60,
      referenceDocNo: 'DO-MATE',
    })

    expect(byOwner).toBeDefined()
    expect(byMate).toBeDefined()

    const pending = await prisma.booking.count({ where: { approvalStatus: 'PENDING' } })
    expect(pending).toBe(0)
  })

  it('customer lain tanpa whitelist tetap masuk antrean', async () => {
    await setManual()

    const beta = await createBooking(customer2Cookie)

    const stored = await prisma.booking.findUniqueOrThrow({ where: { id: beta.id } })
    expect(stored.approvalStatus).toBe('PENDING')
  })
})

describe('filter customer di laporan', () => {
  it('hanya menghitung booking perusahaan yang dipilih', async () => {
    await createBooking(customerCookie)
    await createBooking(customer2Cookie, {
      startMinute: 11 * 60,
      referenceDocNo: 'DO-BETA-2',
    })

    const all = await request(app)
      .get('/api/reports/kpi')
      .query({ from: TOMORROW(), to: TOMORROW() })
      .set('Cookie', adminCookie)
    expect(all.body.data.kpi.totalBookings).toBe(2)

    const filtered = await request(app)
      .get('/api/reports/kpi')
      .query({ from: TOMORROW(), to: TOMORROW(), customerId: alphaId })
      .set('Cookie', adminCookie)

    expect(filtered.status).toBe(200)
    expect(filtered.body.data.kpi.totalBookings).toBe(1)
    expect(filtered.body.data.rows[0].customer).toBe('PT Alpha Logistik')
  })

  it('menampilkan nama perusahaan, bukan nama akun', async () => {
    await createBooking(customerCookie)

    const report = await request(app)
      .get('/api/reports/kpi')
      .query({ from: TOMORROW(), to: TOMORROW() })
      .set('Cookie', adminCookie)

    expect(report.body.data.rows[0].customer).toBe('PT Alpha Logistik')
  })
})

// Dipakai agar import tidak dianggap tak terpakai bila tes berubah.
void TEST_PASSWORD
