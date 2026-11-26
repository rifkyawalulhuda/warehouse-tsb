import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let cookie: string
let adminCookie: string
let truckTypeId: number
let curahId: number
let palletizeId: number

async function seedWithProcessTypes() {
  const seeded = await seedBase(prisma, {
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [
      { truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 },
    ],
    processTypes: [
      { name: 'Curah', durationMinutes: 30 },
      { name: 'Palletize', durationMinutes: 15 },
    ],
  })

  return seeded
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    bookingDate: TOMORROW(),
    activityType: 'UNLOADING',
    truckTypeId,
    startMinute: 9 * 60,
    referenceDocNo: 'DO-PROSES-001',
    ...overrides,
  }
}

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedWithProcessTypes()
  truckTypeId = seeded.truckTypes[0]!.id
  curahId = seeded.processTypes.find((row) => row.name === 'Curah')!.id
  palletizeId = seeded.processTypes.find((row) => row.name === 'Palletize')!.id
  cookie = await loginCookie(app, 'customer1@test.local')
  adminCookie = await loginCookie(app, 'admin@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('Master jenis proses', () => {
  it('Admin bisa menambah jenis proses dengan durasinya', async () => {
    const response = await request(app)
      .post('/api/master/process-types')
      .set('Cookie', adminCookie)
      .send({ name: 'Bagging', durationMinutes: 45 })

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      name: 'Bagging',
      durationMinutes: 45,
      isActive: true,
    })
  })

  it('menolak durasi di luar 1–480 menit', async () => {
    const zero = await request(app)
      .post('/api/master/process-types')
      .set('Cookie', adminCookie)
      .send({ name: 'Nol', durationMinutes: 0 })

    const tooLong = await request(app)
      .post('/api/master/process-types')
      .set('Cookie', adminCookie)
      .send({ name: 'Terlalu lama', durationMinutes: 481 })

    expect(zero.status).toBe(400)
    expect(tooLong.status).toBe(400)
  })

  it('hanya Admin yang boleh mengubah master', async () => {
    const response = await request(app)
      .post('/api/master/process-types')
      .set('Cookie', cookie)
      .send({ name: 'Coba', durationMinutes: 10 })

    expect(response.status).toBe(403)
  })

  it('customer melihat daftar jenis proses di payload pengaturan', async () => {
    const response = await request(app)
      .get('/api/settings')
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    const names = response.body.data.processTypes.map(
      (row: { name: string }) => row.name
    )
    expect(names).toEqual(expect.arrayContaining(['Curah', 'Palletize']))
  })
})

describe('Booking dengan jenis proses', () => {
  it('menambah durasi truk dan menyalin angka ke booking', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: curahId }))

    expect(response.status).toBe(201)

    // 60 menit truk + 30 menit Curah = 90 menit = 3 blok, bukan 2.
    expect(response.body.data).toMatchObject({
      processTypeId: curahId,
      processName: 'Curah',
      processExtraMinutes: 30,
      blocksLocked: 3,
    })
  })

  it('tambahan 15 menit pun bisa melewati batas blok', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: palletizeId }))

    expect(response.status).toBe(201)
    // Truk 60 menit = 2 blok penuh. 60 + 15 = 75 menit tidak lagi muat di dua
    // blok 30 menit, jadi 3 blok. Yang menentukan total, bukan besar tambahannya.
    expect(response.body.data.blocksLocked).toBe(3)
    expect(response.body.data.processExtraMinutes).toBe(15)
  })

  it('tambahan yang tidak melewati batas tidak menambah blok', async () => {
    const engkel = await prisma.truckType.create({
      data: { truckName: 'Engkel', durationMinutes: 40, blocksRequired: 2 },
    })

    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ truckTypeId: engkel.id, processTypeId: palletizeId }))

    expect(response.status).toBe(201)
    // 40 + 15 = 55 menit masih di dalam dua blok 30 menit.
    expect(response.body.data.blocksLocked).toBe(2)
    expect(response.body.data.processExtraMinutes).toBe(15)
  })

  it('menolak booking tanpa jenis proses saat master sudah terisi', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload())

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('PROCESS_TYPE_REQUIRED')
  })

  it('masih bisa booking tanpa jenis proses bila master kosong', async () => {
    // Pengecualian penting: memasang versi ini pada gudang yang belum mengisi
    // Master Data tidak boleh menghentikan semua pemesanan.
    await prisma.processType.updateMany({ data: { isActive: false } })

    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload())

    expect(response.status).toBe(201)
    expect(response.body.data.processTypeId).toBeNull()
    expect(response.body.data.processExtraMinutes).toBe(0)
  })

  it('menolak jenis proses yang nonaktif', async () => {
    await prisma.processType.update({
      where: { id: curahId },
      data: { isActive: false },
    })

    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: curahId }))

    expect(response.status).toBe(404)
  })
})

describe('Ketersediaan slot memperhitungkan jenis proses', () => {
  async function availability(processTypeId?: number) {
    const query = new URLSearchParams({
      date: TOMORROW(),
      activity: 'UNLOADING',
      truckTypeId: String(truckTypeId),
    })
    if (processTypeId !== undefined) {
      query.set('processTypeId', String(processTypeId))
    }

    return request(app)
      .get(`/api/bookings/slots/availability?${query.toString()}`)
      .set('Cookie', cookie)
  }

  it('melaporkan blok yang dibutuhkan sudah termasuk tambahan', async () => {
    const tanpa = await availability()
    const dengan = await availability(curahId)

    expect(tanpa.body.data.blocksRequired).toBe(2)
    expect(dengan.body.data.blocksRequired).toBe(3)
  })

  it('memakai angka yang sama dengan yang disimpan saat booking', async () => {
    const response = await availability(curahId)
    const booking = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: curahId }))

    expect(booking.body.data.blocksLocked).toBe(
      response.body.data.blocksRequired
    )
  })

  it('menolak jenis proses yang tidak dikenal', async () => {
    const response = await availability(999999)

    expect(response.status).toBe(404)
  })
})

describe('Riwayat tidak bergeser saat master diubah', () => {
  it('mengubah durasi master tidak mengubah booking lama', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: curahId }))

    await request(app)
      .patch(`/api/master/process-types/${curahId}`)
      .set('Cookie', adminCookie)
      .send({ durationMinutes: 120 })

    const row = await prisma.booking.findUnique({
      where: { id: created.body.data.id },
    })

    expect(row?.processExtraMinutes).toBe(30)
    expect(row?.blocksLocked).toBe(3)
    expect(row?.processName).toBe('Curah')
  })

  it('menghapus master menyisakan nama di riwayat booking', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send(payload({ processTypeId: curahId }))

    // Dihapus langsung dari database: UI sengaja hanya menyediakan
    // aktif/nonaktif (sama seperti jenis truk dan dock). Yang diuji di sini
    // adalah janji skema — relasi lepas, riwayat tetap utuh.
    await prisma.processType.delete({ where: { id: curahId } })

    const row = await prisma.booking.findUnique({
      where: { id: created.body.data.id },
    })

    expect(row?.processTypeId).toBeNull()
    expect(row?.processName).toBe('Curah')
    expect(row?.processExtraMinutes).toBe(30)
  })
})