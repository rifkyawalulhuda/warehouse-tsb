import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc, todayISO } from '../src/lib/time'
import { resetDatabase, seedBase } from './helpers'

/**
 * Halaman tiket supir adalah satu-satunya penulisan TANPA login di aplikasi
 * ini: token QR adalah kredensialnya. Sampai sekarang belum ada satu tes pun
 * untuk endpoint tulisnya, padahal ia mengubah status booking
 * (BOOKED_INCOMPLETE → BOOKED_READY), mengisi `vehicle_completed_at`, menulis
 * audit, dan menyiarkan realtime.
 */
const app = createApp()

const TOKEN = 'QR-TEST-0000000000000001'
const OTHER_TOKEN = 'QR-TEST-0000000000000002'

async function seedBooking(options: {
  qrToken?: string
  bookingCode?: string
  status?: 'BOOKED_INCOMPLETE' | 'BOOKED_READY' | 'CHECKED_IN_ON_TIME'
  licensePlate?: string | null
  driverName?: string | null
}) {
  const seed = await seedBase(prisma)
  const booking = await prisma.booking.create({
    data: {
      bookingCode: options.bookingCode ?? 'TSB-20261111-001',
      referenceDocNo: 'REF-TEST',
      qrToken: options.qrToken ?? TOKEN,
      customerId: seed.customerA.id,
      createdById: seed.customer.id,
      activityType: 'UNLOADING',
      truckTypeId: seed.truckTypes[0]!.id,
      bookingDate: dateOnlyToUtc(todayISO()),
      startTime: new Date(`${todayISO()}T02:00:00.000Z`),
      endTime: new Date(`${todayISO()}T03:00:00.000Z`),
      blocksLocked: 2,
      status: options.status ?? 'BOOKED_INCOMPLETE',
      licensePlate: options.licensePlate === undefined ? null : options.licensePlate,
      driverName: options.driverName === undefined ? null : options.driverName,
    },
  })

  return { seed, booking }
}

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('PATCH /api/tickets/:qrToken/vehicle-info', () => {
  it('melengkapi data kendaraan dan menaikkan status ke BOOKED_READY', async () => {
    const { booking } = await seedBooking({})

    const response = await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ licensePlate: 'B 9999 XYZ', driverName: 'Pak Supir' })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      status: 'BOOKED_READY',
      licensePlate: 'B 9999 XYZ',
    })

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.status).toBe('BOOKED_READY')
    expect(saved.driverName).toBe('Pak Supir')

    // `vehicle_completed_at` dipakai laporan: tanpa ini penyelesaian data
    // kendaraan tidak terukur sama sekali.
    const timeLog = await prisma.bookingTimeLog.findUniqueOrThrow({
      where: { bookingId: booking.id },
    })
    expect(timeLog.vehicleCompletedAt).toBeInstanceOf(Date)

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { bookingId: booking.id, action: 'VEHICLE_INFO_UPDATED_BY_DRIVER' },
    })
    // Nilai lama ikut tercatat, bukan hanya "ada yang mengubah".
    expect(audit.meta).toMatchObject({
      complete: true,
      previous: { licensePlate: null, driverName: null },
    })
  })

  it('mengosongkan vehicle_completed_at bila datanya jadi tidak lengkap', async () => {
    const { booking } = await seedBooking({
      status: 'BOOKED_READY',
      licensePlate: 'B 1234 AAA',
      driverName: 'Pak Supir',
    })
    // Hanya plat yang dikirim; nama yang ada tetap dipakai, jadi data masih
    // lengkap dan status tidak turun. Untuk menguji penurunan status, kolom
    // nama harus benar-benar kosong di database.
    await prisma.booking.update({ where: { id: booking.id }, data: { driverName: null } })

    const response = await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ driverName: '' })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('BOOKED_INCOMPLETE')

    const timeLog = await prisma.bookingTimeLog.findUniqueOrThrow({
      where: { bookingId: booking.id },
    })
    expect(timeLog.vehicleCompletedAt).toBeNull()
  })

  it('menolak plat kosong/spasi sehingga plat lama tidak terhapus', async () => {
    const { booking } = await seedBooking({
      status: 'BOOKED_READY',
      licensePlate: 'B 1234 AAA',
      driverName: 'Pak Supir',
    })

    const response = await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ licensePlate: '   ', driverName: '' })

    // `plateSchema` men-trim lalu menuntut minimal 3 karakter. Penolakan ini
    // yang mencegah satu permintaan kosong menghapus plat yang sudah benar.
    expect(response.status).toBe(400)

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.licensePlate).toBe('B 1234 AAA')
    expect(saved.driverName).toBe('Pak Supir')
    expect(saved.status).toBe('BOOKED_READY')
  })

  it('memakai nilai lama bila nama supir dikirim kosong', async () => {
    const { booking } = await seedBooking({
      status: 'BOOKED_READY',
      licensePlate: 'B 1234 AAA',
      driverName: 'Pak Supir',
    })

    const response = await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ driverName: '' })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      status: 'BOOKED_READY',
      licensePlate: 'B 1234 AAA',
    })

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.driverName).toBe('Pak Supir')
  })

  it('menolak VEHICLE_LOCKED setelah truk masuk gerbang tanpa mengubah status', async () => {
    const { booking } = await seedBooking({ status: 'CHECKED_IN_ON_TIME' })

    const response = await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ licensePlate: 'B 7777 LOCKED', driverName: 'Penyusup' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('VEHICLE_LOCKED')

    const saved = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })
    expect(saved.status).toBe('CHECKED_IN_ON_TIME')
    expect(saved.licensePlate).toBeNull()
  })

  it('tidak menyentuh booking lain walaupun berada di tanggal yang sama', async () => {
    const { booking } = await seedBooking({})
    const other = await prisma.booking.create({
      data: {
        bookingCode: 'TSB-20261111-002',
        referenceDocNo: 'REF-LAIN',
        qrToken: OTHER_TOKEN,
        customerId: booking.customerId,
        createdById: booking.createdById,
        activityType: 'UNLOADING',
        truckTypeId: booking.truckTypeId,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        blocksLocked: 2,
        status: 'BOOKED_INCOMPLETE',
      },
    })

    await request(app)
      .patch(`/api/tickets/${TOKEN}/vehicle-info`)
      .send({ licensePlate: 'B 1111 AAA', driverName: 'Supir Satu' })
      .expect(200)

    const untouched = await prisma.booking.findUniqueOrThrow({ where: { id: other.id } })
    expect(untouched.status).toBe('BOOKED_INCOMPLETE')
    expect(untouched.licensePlate).toBeNull()
    expect(untouched.driverName).toBeNull()
  })

  it('menjawab 404 untuk token yang bentuknya jelas bukan token, tanpa menyentuh database', async () => {
    await seedBooking({})

    const short = await request(app).patch('/api/tickets/pendek/vehicle-info').send({})
    expect(short.status).toBe(404)

    const unknown = await request(app)
      .patch('/api/tickets/QR-TEST-00000000TIDAKADA/vehicle-info')
      .send({ licensePlate: 'B 1 X' })
    expect(unknown.status).toBe(404)
  })
})

describe('GET /api/tickets/:qrToken', () => {
  it('menjawab 404 untuk token pendek pada semua rute token', async () => {
    // Aturan panjang token dulu ditulis ulang per rute dan satu rute lupa.
    // Sekarang satu helper dipakai ketiganya, jadi perilakunya harus sama.
    for (const path of ['/api/tickets/pendek', '/api/tickets/pendek/context']) {
      const response = await request(app).get(path)
      expect(response.status, path).toBe(404)
    }
  })

  it('tidak membocorkan email atau nomor internal customer', async () => {
    const { seed } = await seedBooking({ status: 'BOOKED_READY' })

    const response = await request(app).get(`/api/tickets/${TOKEN}`).expect(200)

    const body = JSON.stringify(response.body)
    expect(body).not.toContain(seed.customer.email)
    expect(body).not.toContain(seed.customerA.code)
  })
})
