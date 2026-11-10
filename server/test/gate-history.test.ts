import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { addDaysISO, dateOnlyToUtc, jakartaInstant, todayISO, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

/**
 * Booking siap gate-in: jadwalnya beberapa menit dari sekarang, sehingga
 * `earlyArrival` tidak aktif apa pun jam tes dijalankan.
 */
async function seedBooking(options: {
  customerId: string
  truckTypeId: number
  startTime: Date
  status?: 'BOOKED_INCOMPLETE' | 'BOOKED_READY' | 'COMPLETED' | 'CHECKED_OUT'
}) {
  const companyId = (
    await prisma.user.findUniqueOrThrow({
      where: { id: options.customerId },
      select: { customerId: true },
    })
  ).customerId

  return prisma.booking.create({
    data: {
      bookingCode: `T-${Math.random().toString(36).slice(2, 8)}`,
      referenceDocNo: 'REF-TEST',
      qrToken: Math.random().toString(36).slice(2).padEnd(32, '0'),
      customerId: companyId!,
      createdById: options.customerId,
      activityType: 'UNLOADING',
      truckTypeId: options.truckTypeId,
      bookingDate: dateOnlyToUtc(utcToDateOnly(options.startTime)),
      startTime: options.startTime,
      endTime: new Date(options.startTime.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: options.status ?? 'BOOKED_READY',
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

describe('riwayat gate', () => {
  it('mencatat pemindaian QR yang tidak dikenali', async () => {
    await resetDatabase(prisma)
    const { gate } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get('/api/ops/scan/qr-yang-tidak-ada?record=1')
      .set('Cookie', cookie)

    expect(response.status).toBe(404)

    const attempts = await prisma.scanAttempt.findMany()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      reason: 'NOT_FOUND',
      userId: gate.id,
      userRole: 'GATE_OFFICER',
      bookingId: null,
    })
  })

  it('tidak mencatat pemindaian otomatis saat layar menyegarkan diri', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get('/api/ops/scan/qr-yang-tidak-ada')
      .set('Cookie', cookie)

    expect(response.status).toBe(404)
    expect(await prisma.scanAttempt.count()).toBe(0)
  })

  it('tidak mencatat tiket yang berhasil dipindai', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: new Date(Date.now() + 5 * 60_000),
    })

    const response = await request(app)
      .get(`/api/ops/scan/${booking.qrToken}?record=1`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.canGateIn).toBe(true)
    expect(await prisma.scanAttempt.count()).toBe(0)
  })

  it('mengabaikan pengulangan pemindaian yang sama dalam semenit', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .get('/api/ops/scan/qr-kembar?record=1')
        .set('Cookie', cookie)
    }

    expect(await prisma.scanAttempt.count()).toBe(1)
  })

  it('menggabungkan gate-in, gate-out, dan penolakan dalam satu kronologi', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes, gate } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')
    const date = todayISO()

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(date, 9 * 60),
    })

    await prisma.bookingTimeLog.create({
      data: {
        bookingId: booking.id,
        gateInAt: jakartaInstant(date, 9 * 60),
        gateInBy: gate.id,
        gateOutAt: jakartaInstant(date, 11 * 60),
        gateOutBy: gate.id,
      },
    })

    await prisma.scanAttempt.create({
      data: {
        qrToken: 'qr-palsu',
        reason: 'NOT_FOUND',
        message: 'QR Code tidak dikenali',
        userId: gate.id,
        userRole: 'GATE_OFFICER',
        createdAt: jakartaInstant(date, 10 * 60),
      },
    })

    const response = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: date, to: date })
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    const rows = response.body.data.rows
    expect(rows.map((row: { event: string }) => row.event)).toEqual([
      'GATE_OUT',
      'REJECTED',
      'GATE_IN',
    ])

    const gateOut = rows[0]
    expect(gateOut.minutesInside).toBe(120)
    expect(gateOut.bookingCode).toBe(booking.bookingCode)
    expect(gateOut.customer).toBe('PT Alpha Logistik')
    expect(gateOut.officerName).toBe('Gate Tes')

    const rejected = rows[1]
    expect(rejected.reason).toBe('NOT_FOUND')
    expect(rejected.bookingCode).toBeNull()
    expect(rejected.qrToken).toBe('qr-palsu')
  })

  it('menyaring menurut tanggal dan kata kunci', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes, gate } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')
    const today = todayISO()
    const yesterday = addDaysISO(today, -1)

    const kemarin = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(yesterday, 9 * 60),
    })
    const hariIni = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(today, 9 * 60),
    })

    await prisma.bookingTimeLog.createMany({
      data: [
        { bookingId: kemarin.id, gateInAt: jakartaInstant(yesterday, 9 * 60), gateInBy: gate.id },
        { bookingId: hariIni.id, gateInAt: jakartaInstant(today, 9 * 60), gateInBy: gate.id },
      ],
    })

    const rentangHariIni = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: today, to: today })
      .set('Cookie', cookie)

    expect(rentangHariIni.body.data.rows).toHaveLength(1)
    expect(rentangHariIni.body.data.rows[0].bookingCode).toBe(hariIni.bookingCode)

    const dicari = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: yesterday, to: today, q: kemarin.bookingCode })
      .set('Cookie', cookie)

    expect(dicari.body.data.rows).toHaveLength(1)
    expect(dicari.body.data.rows[0].bookingCode).toBe(kemarin.bookingCode)
  })

  it('pencarian plat juga menemukan penolakan yang punya tiket', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes, gate } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')
    const today = todayISO()

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(today, 9 * 60),
    })

    await prisma.scanAttempt.create({
      data: {
        qrToken: booking.qrToken,
        reason: 'EARLY_ARRIVAL',
        message: 'Truk datang terlalu awal',
        userId: gate.id,
        userRole: 'GATE_OFFICER',
        bookingId: booking.id,
        createdAt: jakartaInstant(today, 8 * 60),
      },
    })

    const response = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: today, to: today, q: '1234 TSB' })
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    const rows = response.body.data.rows
    expect(rows).toHaveLength(1)
    expect(rows[0].event).toBe('REJECTED')
    expect(rows[0].reason).toBe('EARLY_ARRIVAL')
    expect(rows[0].licensePlate).toBe('B 1234 TSB')
  })

  it('menolak rentang tanggal yang terbalik', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')
    const today = todayISO()

    const response = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: today, to: addDaysISO(today, -1) })
      .set('Cookie', cookie)

    expect(response.status).toBe(400)
  })

  it('hanya terbuka untuk Admin, Security, dan Checker', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const today = todayISO()

    const gate = await loginCookie(app, 'gate@test.local')
    const checker = await loginCookie(app, 'checker@test.local')
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')

    for (const cookie of [gate, checker, admin]) {
      const response = await request(app)
        .get('/api/ops/gate-history')
        .query({ from: today, to: today })
        .set('Cookie', cookie)
      expect(response.status).toBe(200)
    }

    const ditolak = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: today, to: today })
      .set('Cookie', customer)
    expect(ditolak.status).toBe(403)

    const tanpaLogin = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: today, to: today })
    expect(tanpaLogin.status).toBe(401)
  })
})
