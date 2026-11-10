import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

/**
 * Booking dengan kode booking seperti yang dicetak di tiket. Token QR sengaja
 * dibuat berbeda jauh dari kode booking, karena itulah kenyataan di produksi:
 * QR memuat 24 byte acak, bukan kode yang tercetak.
 */
async function seedBooking(options: {
  customerId: string
  truckTypeId: number
  bookingCode: string
  qrToken: string
  startTime: Date
}) {
  const companyId = (
    await prisma.user.findUniqueOrThrow({
      where: { id: options.customerId },
      select: { customerId: true },
    })
  ).customerId

  return prisma.booking.create({
    data: {
      bookingCode: options.bookingCode,
      referenceDocNo: 'REF-TEST',
      qrToken: options.qrToken,
      customerId: companyId!,
      createdById: options.customerId,
      activityType: 'UNLOADING',
      truckTypeId: options.truckTypeId,
      bookingDate: dateOnlyToUtc(utcToDateOnly(options.startTime)),
      startTime: options.startTime,
      endTime: new Date(options.startTime.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: 'BOOKED_READY',
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

const QR_TOKEN = 'Xk3pQ9rT2mZ7vB1nL5wY8cD4'
const BOOKING_CODE = 'TSB-20261111-003'

async function prepare() {
  await resetDatabase(prisma)
  const seed = await seedBase(prisma)
  const booking = await seedBooking({
    customerId: seed.customer.id,
    truckTypeId: seed.truckTypes[0]!.id,
    bookingCode: BOOKING_CODE,
    qrToken: QR_TOKEN,
    startTime: new Date(Date.now() + 5 * 60_000),
  })
  return { seed, booking }
}

describe('pindai tiket di gate', () => {
  it('menerima kode booking yang diketik manual', async () => {
    await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get(`/api/ops/scan/${BOOKING_CODE}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.booking.bookingCode).toBe(BOOKING_CODE)
    expect(response.body.data.canGateIn).toBe(true)
  })

  it('menerima kode booking yang diketik dengan huruf kecil', async () => {
    await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get(`/api/ops/scan/${BOOKING_CODE.toLowerCase()}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.booking.bookingCode).toBe(BOOKING_CODE)
  })

  it('tetap menerima token QR hasil pindai kamera', async () => {
    await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get(`/api/ops/scan/${QR_TOKEN}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.booking.qrToken).toBe(QR_TOKEN)
  })

  it('mencatat kode booking yang tidak ada sebagai penolakan', async () => {
    await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .get('/api/ops/scan/TSB-20261111-999?record=1')
      .set('Cookie', cookie)

    expect(response.status).toBe(404)
    const attempts = await prisma.scanAttempt.findMany()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      qrToken: 'TSB-20261111-999',
      reason: 'NOT_FOUND',
      bookingId: null,
    })
  })

  it('melakukan gate-in dari kode booking', async () => {
    const { booking } = await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', cookie)
      .send({ qrToken: BOOKING_CODE })

    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(booking.id)
    expect(response.body.data.status).toBe('CHECKED_IN_ON_TIME')
  })

  it('melakukan gate-out dari kode booking', async () => {
    const { booking } = await prepare()
    const cookie = await loginCookie(app, 'gate@test.local')

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED' },
    })

    const response = await request(app)
      .post('/api/ops/gate-out')
      .set('Cookie', cookie)
      .send({ qrToken: BOOKING_CODE })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('CHECKED_OUT')
  })

  it('membuka hasil pindai checker dari kode booking', async () => {
    const { booking } = await prepare()
    const cookie = await loginCookie(app, 'checker@test.local')

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CHECKED_IN_ON_TIME' },
    })
    await prisma.bookingTimeLog.create({
      data: { bookingId: booking.id, gateInAt: new Date() },
    })

    const response = await request(app)
      .get(`/api/ops/checker/scan/${BOOKING_CODE}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.booking.bookingCode).toBe(BOOKING_CODE)
    expect(response.body.data.actions.assignDock).toBe(true)
  })

  it('tidak membuka tiket publik lewat kode booking', async () => {
    await prepare()

    const response = await request(app).get(`/api/tickets/${BOOKING_CODE}`)

    expect(response.status).toBe(404)
  })
})
