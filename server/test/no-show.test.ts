import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { markNoShowBookings } from '../src/jobs/no-show'
import { capacityForActivity, getSettings, toWindow } from '../src/lib/settings'
import { reserveBlocks } from '../src/modules/bookings/quota-service'
import { addDaysISO, dateOnlyToUtc, jakartaInstant, todayISO, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

async function seedBooking(options: {
  customerId: string
  truckTypeId: number
  startTime: Date
  bookingDate?: string
  durationMinutes?: number
  status?: 'BOOKED_INCOMPLETE' | 'BOOKED_READY'
}) {
  const duration = options.durationMinutes ?? 60
  return prisma.booking.create({
    data: {
      bookingCode: `T-${Math.random().toString(36).slice(2, 8)}`,
      referenceDocNo: 'REF-TEST',
      qrToken: Math.random().toString(36).slice(2).padEnd(32, '0'),
      customerId: options.customerId,
      activityType: 'UNLOADING',
      truckTypeId: options.truckTypeId,
      bookingDate: dateOnlyToUtc(options.bookingDate ?? utcToDateOnly(options.startTime)),
      startTime: options.startTime,
      endTime: new Date(options.startTime.getTime() + duration * 60 * 1000),
      // Snapshot blok, sama seperti yang dibuat endpoint POST /api/bookings.
      blocksLocked: Math.ceil(duration / 30),
      status: options.status ?? 'BOOKED_READY',
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

describe('cron NO_SHOW', () => {
  it('tidak menandai booking hari ini yang jam selesainya sudah lewat tapi gudang masih buka', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma, {
      operatingStartMinute: 480,
      operatingEndMinute: 1020,
    })

    const date = todayISO()
    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(date, 9 * 60),
    })

    // 16:00 — jadwal 09:00 sudah lewat 7 jam, tapi gudang tutup 17:00.
    const marked = await markNoShowBookings(jakartaInstant(date, 16 * 60))

    expect(marked).toBe(0)
    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(after?.status).toBe('BOOKED_READY')
  })

  it('menandai NO_SHOW setelah jam operasional tutup', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma, {
      operatingStartMinute: 480,
      operatingEndMinute: 1020,
    })

    const date = todayISO()
    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(date, 9 * 60),
    })

    const marked = await markNoShowBookings(jakartaInstant(date, 17 * 60))

    expect(marked).toBe(1)
    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(after?.status).toBe('NO_SHOW')
  })

  it('menandai booking hari kemarin tanpa melihat jam', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma)
    const date = addDaysISO(todayISO(), -1)

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(date, 9 * 60),
    })

    const marked = await markNoShowBookings(jakartaInstant(todayISO(), 8 * 60))

    expect(marked).toBe(1)
    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(after?.status).toBe('NO_SHOW')
  })

  it('truk yang datang terlambat tetap bisa gate-in selama hari operasional belum tutup', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes, gate } = await seedBase(prisma, {
      // Jendela penuh sehari supaya tes tidak bergantung pada jam berjalan.
      operatingStartMinute: 0,
      operatingEndMinute: 1440,
    })
    const cookie = await loginCookie(app, gate.email)

    // Jadwal mulai 60 menit lalu, sejajar blok 30 menit. Jam selesai slot sudah
    // lewat, tapi hari operasional belum tutup.
    const now = new Date()
    const blockMs = 30 * 60 * 1000
    const startTime = new Date(Math.floor(now.getTime() / blockMs) * blockMs - 60 * 60 * 1000)
    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime,
    })

    // Cron berjalan setelah jam selesai booking, masih di hari yang sama.
    const afterSlot = new Date(startTime.getTime() + 90 * 60 * 1000)
    await markNoShowBookings(afterSlot)
    await markNoShowBookings(new Date(afterSlot.getTime() + 60 * 60 * 1000))

    const stillBooked = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(stillBooked?.status).toBe('BOOKED_READY')

    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', cookie)
      .send({ qrToken: booking.qrToken })

    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('LATE_WAITING_LIST')
  })

  it('mengubah durasi jenis truk tidak mengubah jumlah blok yang dilepas', async () => {
    await resetDatabase(prisma)
    const { admin, customer, truckTypes } = await seedBase(prisma)
    const adminCookie = await loginCookie(app, admin.email)

    // Tronton 90 menit = 3 blok.
    const type = truckTypes[1]!
    expect(type.blocksRequired).toBe(3)

    const date = addDaysISO(todayISO(), -1)
    const slotDate = new Date(`${date}T00:00:00.000Z`)

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: type.id,
      startTime: jakartaInstant(date, 9 * 60),
      bookingDate: date,
      durationMinutes: 90,
    })
    expect(booking.blocksLocked).toBe(3)

    // Kunci kuotanya persis seperti yang dilakukan POST /api/bookings.
    const settings = await getSettings()
    const window = toWindow(settings)
    const capacity = await capacityForActivity('UNLOADING')
    await prisma.$transaction(async (tx) => {
      await reserveBlocks(
        tx,
        { date, activity: 'UNLOADING', window, capacity },
        9 * 60,
        3
      )
    })

    const sumUsed = async () => {
      const rows = await prisma.slotAllocation.findMany({
        where: { slotDate, activity: 'UNLOADING' },
      })
      return rows.reduce((total, row) => total + row.used, 0)
    }
    expect(await sumUsed()).toBe(3)

    // Admin memperpendek durasi: jenis truk kini 2 blok.
    const patched = await request(app)
      .patch(`/api/master/truck-types/${type.id}`)
      .set('Cookie', adminCookie)
      .send({ durationMinutes: 60 })

    expect(patched.status).toBe(200)
    expect(patched.body.data.blocksRequired).toBe(2)

    const marked = await markNoShowBookings(jakartaInstant(todayISO(), 8 * 60))
    expect(marked).toBe(1)

    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(after?.status).toBe('NO_SHOW')
    // Harus kembali 3 blok (snapshot), bukan 2 mengikuti jenis truk yang baru.
    expect(await sumUsed()).toBe(0)
  })
})
