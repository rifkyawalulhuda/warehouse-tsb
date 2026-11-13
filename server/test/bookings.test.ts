import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import {
  activityDocks,
  loginCookie,
  resetDatabase,
  seedBase,
  type SeededUser,
} from './helpers'

const prisma = new PrismaClient()
const app = createApp()

/** Tanggal besok: selalu di dalam jendela booking dan tidak pernah "jam sudah lewat". */
const TOMORROW = () => addDaysISO(todayISO(), 1)

let customer: SeededUser
let truckTypeId: number
let cookie: string
let cookie2: string
let seededCustomerAId: string

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {
    // Dua dock unloading -> kapasitas 2 per blok; cukup untuk menguji sisa kuota.
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [
      { truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 },
      { truckName: 'Tronton', durationMinutes: 90, blocksRequired: 3 },
    ],
  })
  customer = seeded.customer
  seededCustomerAId = seeded.customerA.id
  truckTypeId = seeded.truckTypes[0]!.id
  cookie = await loginCookie(app, 'customer1@test.local')
  cookie2 = await loginCookie(app, 'customer2@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    bookingDate: TOMORROW(),
    activityType: 'UNLOADING',
    truckTypeId,
    startMinute: 9 * 60,
    referenceDocNo: 'DO-TEST-001',
    licensePlate: 'B 1234 XYZ',
    driverName: 'Supir Tes',
    driverPhone: '081234567890',
    ...overrides,
  }
}

describe('POST /api/bookings', () => {
  it('membuat booking lengkap dan memakai kuota semua blok', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('BOOKED_READY')
    expect(response.body.data.bookingCode).toMatch(/^TSB-\d{8}-001$/)

    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
      orderBy: { slotStartMinute: 'asc' },
    })
    const used = slots.filter((slot) => slot.used > 0).map((slot) => slot.slotStartMinute)
    expect(used).toEqual([540, 570])
    // Snapshot kapasitas ikut tersimpan untuk laporan historis.
    expect(slots.every((slot) => slot.capacity === 2)).toBe(true)
  })

  it('menandai BOOKED_INCOMPLETE bila data kendaraan belum lengkap', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ licensePlate: '', driverName: '' }))

    expect(response.status).toBe(201)
    expect(response.body.data.status).toBe('BOOKED_INCOMPLETE')
  })

  it('menolak tanggal di luar jendela booking H+7', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ bookingDate: addDaysISO(todayISO(), 30) }))

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('DATE_TOO_FAR')
  })

  it('menolak jam yang tidak sejajar satuan blok', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ startMinute: 9 * 60 + 10 }))

    expect(response.status).toBe(400)
  })

  it('menolak role selain customer', async () => {
    const gateCookie = await loginCookie(app, 'gate@test.local')
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', gateCookie)
      .send(createPayload())

    expect(response.status).toBe(403)
  })

  it('menolak booking tanpa sesi', async () => {
    const response = await request(app).post('/api/bookings').send(createPayload())
    expect(response.status).toBe(401)
  })
})

describe('kuota per blok', () => {
  it('menolak booking yang salah satu blok tengahnya sudah penuh', async () => {
    // Kapasitas 2. Isi blok 10:00-11:00 dua kali supaya blok 10:00 dan 10:30 penuh.
    for (const index of [1, 2]) {
      const ok = await request(app)
        .post('/api/bookings')
        .set('Cookie', index === 1 ? cookie : cookie2)
        .send(createPayload({ startMinute: 10 * 60, referenceDocNo: `DO-FULL-${index}` }))
      expect(ok.status).toBe(201)
    }

    // 09:30-10:30 menyentuh blok 10:00 yang sudah penuh -> harus ditolak.
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ startMinute: 9 * 60 + 30, referenceDocNo: 'DO-TENGAH' }))

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('QUOTA_FULL')
  })

  it('tetap mengizinkan jam yang tidak menyentuh blok penuh', async () => {
    for (const index of [1, 2]) {
      await request(app)
        .post('/api/bookings')
        .set('Cookie', index === 1 ? cookie : cookie2)
        .send(createPayload({ startMinute: 10 * 60, referenceDocNo: `DO-FULL-${index}` }))
    }

    // 08:00-09:00 tidak menyentuh blok 10:00.
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ startMinute: 8 * 60, referenceDocNo: 'DO-PAGI' }))

    expect(response.status).toBe(201)
  })

  it('mengembalikan kuota saat booking dibatalkan', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())
    expect(created.status).toBe(201)

    const cancel = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', cookie)
    expect(cancel.status).toBe(200)

    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
    })
    expect(slots.every((slot) => slot.used === 0)).toBe(true)
  })

  it('menolak pembatalan oleh customer lain', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())

    const response = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', cookie2)

    expect(response.status).toBe(403)
  })
})

/**
 * Pembatalan hanya milik customer pemilik dan Admin.
 *
 * Petugas gate dan checker tidak membatalkan booking: tiket yang truknya tidak
 * datang diselesaikan lewat NO_SHOW (otomatis atau penandaan manual), yang
 * juga mengembalikan kuota. Tanpa batas ini, satu orang di pos gate bisa
 * menghapus jadwal perusahaan mana pun tanpa jejak alasan.
 */
describe('POST /api/bookings/:id/cancel - kebijakan peran', () => {
  it('menolak pembatalan oleh petugas gate dan tidak melepas kuota', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())
    expect(created.status).toBe(201)

    const gateCookie = await loginCookie(app, 'gate@test.local')
    const response = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', gateCookie)

    expect(response.status).toBe(403)

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: created.body.data.id },
      select: { status: true },
    })
    expect(booking.status).toBe('BOOKED_READY')

    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
    })
    expect(slots.some((slot) => slot.used > 0)).toBe(true)
  })

  it('menolak pembatalan oleh checker', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())

    const checkerCookie = await loginCookie(app, 'checker@test.local')
    const response = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', checkerCookie)

    expect(response.status).toBe(403)
  })

  it('mengizinkan Admin membatalkan booking milik perusahaan mana pun', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie2)
      .send(createPayload())
    expect(created.status).toBe(201)

    const adminCookie = await loginCookie(app, 'admin@test.local')
    const response = await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', adminCookie)

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('CANCELLED')
  })

  it('pembatalan ganda yang bersamaan hanya berhasil sekali', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload())
    expect(created.status).toBe(201)

    const cancel = () =>
      request(app).post(`/api/bookings/${created.body.data.id}/cancel`).set('Cookie', cookie)

    const responses = await Promise.all([cancel(), cancel()])
    const statuses = responses.map((response) => response.status).sort()

    expect(statuses).toEqual([200, 409])

    // Kuota kembali persis sekali, tidak dua kali.
    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
    })
    expect(slots.every((slot) => slot.used === 0)).toBe(true)
  })
})

describe('GET /api/bookings/my-list', () => {
  it('hanya menampilkan booking milik perusahaan customer yang login', async () => {
    await request(app).post('/api/bookings').set('Cookie', cookie).send(createPayload())
    await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie2)
      .send(createPayload({ startMinute: 13 * 60, referenceDocNo: 'DO-OTHER' }))

    const mine = await request(app).get('/api/bookings/my-list').set('Cookie', cookie)
    expect(mine.status).toBe(200)
    expect(mine.body.data).toHaveLength(1)
    // Pemilik bisnis kini perusahaan, bukan akun.
    expect(mine.body.data[0].customer.id).toBe(seededCustomerAId)
    expect(mine.body.data[0].createdBy.id).toBe(customer.id)
  })
})

describe('GET /api/bookings/slots/availability', () => {
  it('menghitung sisa kuota dari blok yang sudah terpakai', async () => {
    await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(createPayload({ startMinute: 9 * 60 }))

    const response = await request(app)
      .get('/api/bookings/slots/availability')
      .query({ date: TOMORROW(), activity: 'UNLOADING', truckTypeId })
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    const slots = response.body.data.slots as Array<{
      startMinute: number
      remaining: number
      status: string
    }>

    // 09:00 dan 09:30 sudah terpakai satu, kapasitas 2 -> sisa 1.
    expect(slots.find((slot) => slot.startMinute === 540)?.remaining).toBe(1)
    // 08:00 tidak menyentuh blok terpakai -> sisa 2.
    expect(slots.find((slot) => slot.startMinute === 480)?.remaining).toBe(2)
    // 10:00 masih kosong.
    expect(slots.find((slot) => slot.startMinute === 600)?.remaining).toBe(2)
  })
})
