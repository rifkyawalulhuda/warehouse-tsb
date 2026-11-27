import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

/**
 * Baris slot disimpan per tanggal, jadi mengubah satuan blok atau jam buka
 * meninggalkan baris lama di grid lama. Dulu baris baru dibuat dengan `used: 0`
 * sementara baris lama tetap memegang pemakaian, sehingga ketersediaan
 * melaporkan slot kosong padahal dock terisi dan customer bisa memesan melebihi
 * kapasitas gudang.
 */
describe('perubahan grid slot', () => {
  async function slotRows(date: string) {
    const rows = await prisma.slotAllocation.findMany({
      where: { activity: 'UNLOADING', slotDate: new Date(`${date}T00:00:00.000Z`) },
      orderBy: { slotStartMinute: 'asc' },
      select: { slotStartMinute: true, used: true, capacity: true },
    })
    return rows
  }

  async function createBooking(cookie: string, date: string, startMinute: number) {
    const truck = await prisma.truckType.findFirstOrThrow({
      where: { truckName: 'CDD Long' },
    })
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({
        bookingDate: date,
        startMinute,
        activityType: 'UNLOADING',
        truckTypeId: truck.id,
        referenceDocNo: `DO-GRID-${startMinute}`,
        licensePlate: 'B 9001 GRD',
        driverName: 'Supir Grid',
      })
    expect(response.status, JSON.stringify(response.body)).toBe(201)
    return response.body.data as { id: string; bookingCode: string }
  }

  it('memindahkan pemakaian ke grid baru saat satuan blok diperbesar', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')
    const date = addDaysISO(todayISO(), 2)

    // CDD Long 60 menit pada blok 30 menit menempati 09:00 dan 09:30.
    await createBooking(customer, date, 540)
    expect((await slotRows(date)).filter((row) => row.used > 0)).toEqual([
      expect.objectContaining({ slotStartMinute: 540, used: 1 }),
      expect.objectContaining({ slotStartMinute: 570, used: 1 }),
    ])

    const saved = await request(app)
      .put('/api/settings')
      .set('Cookie', admin)
      .send({ slotUnitMinutes: 60 })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)

    // Grid baru: 08:00, 09:00, ... 16:00 (9 baris). Booking 09:00-10:00
    // menempati tepat satu blok 60 menit — bukan dua, walau dulu tersimpan di
    // dua baris 30 menit.
    const rows = await slotRows(date)
    expect(rows.map((row) => row.slotStartMinute)).toEqual([
      480, 540, 600, 660, 720, 780, 840, 900, 960,
    ])
    expect(rows.filter((row) => row.used > 0)).toEqual([
      expect.objectContaining({ slotStartMinute: 540, used: 1 }),
    ])
  })

  it('tidak melaporkan slot kosong setelah grid berubah', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')
    const date = addDaysISO(todayISO(), 2)
    const truck = await prisma.truckType.findFirstOrThrow({
      where: { truckName: 'CDD Long' },
    })

    await createBooking(customer, date, 540)
    await request(app).put('/api/settings').set('Cookie', admin).send({ slotUnitMinutes: 60 })

    const availability = await request(app)
      .get('/api/bookings/slots/availability')
      .query({ date, activity: 'UNLOADING', truckTypeId: truck.id })
      .set('Cookie', customer)

    expect(availability.status).toBe(200)
    const slots = availability.body.data.slots as Array<{
      startMinute: number
      status: string
      remaining: number
    }>
    // Kapasitas 1 dock, dan 09:00 sudah dipakai booking yang jamnya beririsan.
    expect(slots.find((slot) => slot.startMinute === 540)).toMatchObject({
      status: 'FULL',
      remaining: 0,
    })
    expect(slots.find((slot) => slot.startMinute === 480)).toMatchObject({
      status: 'AVAILABLE',
      remaining: 1,
    })
  })

  it('melepas blok yang benar saat booking dibatalkan setelah grid berubah', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')
    const date = addDaysISO(todayISO(), 2)

    const booking = await createBooking(customer, date, 540)
    await request(app).put('/api/settings').set('Cookie', admin).send({ slotUnitMinutes: 60 })

    const cancelled = await request(app)
      .post(`/api/bookings/${booking.id}/cancel`)
      .set('Cookie', customer)
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200)

    // Snapshot booking menunjuk grid 30 menit (540 dan 570). Kalau pelepasan
    // memakai snapshot itu apa adanya, baris 570 tidak ada di grid baru dan
    // blok 09:00 tetap "terpakai" selamanya.
    const rows = await slotRows(date)
    expect(rows.every((row) => row.used === 0)).toBe(true)
  })

  it('menyusun ulang baris saat jam buka digeser', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')
    const date = addDaysISO(todayISO(), 3)

    // 09:30 menempati 09:30 dan 10:00 pada grid 30 menit.
    await createBooking(customer, date, 570)

    const saved = await request(app)
      .put('/api/settings')
      .set('Cookie', admin)
      .send({ operatingStartMinute: 540 })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)

    const rows = await slotRows(date)
    // 09:00-17:00 dengan blok 30 menit = 16 baris, mulai 09:00.
    expect(rows).toHaveLength(16)
    expect(rows[0]?.slotStartMinute).toBe(540)
    expect(rows.filter((row) => row.used > 0)).toEqual([
      expect.objectContaining({ slotStartMinute: 570, used: 1 }),
      expect.objectContaining({ slotStartMinute: 600, used: 1 }),
    ])
  })

  it('tidak menyentuh baris slot bila perubahan tidak menggeser grid', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')
    const date = addDaysISO(todayISO(), 2)

    await createBooking(customer, date, 540)
    const before = await slotRows(date)

    await request(app).put('/api/settings').set('Cookie', admin).send({ appName: 'Nama Baru' })

    expect(await slotRows(date)).toEqual(before)
  })
})
