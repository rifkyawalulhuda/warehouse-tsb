import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

/**
 * Tes inti: satu-satunya cara membuktikan SELECT ... FOR UPDATE bekerja adalah
 * menembakkan beberapa permintaan sungguhan secara bersamaan ke Postgres.
 * Mock tidak akan pernah menangkap race condition di sini.
 */
describe('konkurensi kuota', () => {
  it('tepat satu dari dua booking paralel berhasil saat sisa kuota 1', async () => {
    // Satu dock -> kapasitas 1 per blok.
    const seeded = await seedBase(prisma, {
      docks: activityDocks(1, 'UNLOADING'),
      truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
    })
    const truckTypeId = seeded.truckTypes[0]!.id
    const [cookieA, cookieB] = await Promise.all([
      loginCookie(app, 'customer1@test.local'),
      loginCookie(app, 'customer2@test.local'),
    ])

    const payload = (reference: string) => ({
      bookingDate: TOMORROW(),
      activityType: 'UNLOADING',
      truckTypeId,
      startMinute: 9 * 60,
      referenceDocNo: reference,
      licensePlate: 'B 1111 AA',
      driverName: 'Supir',
    })

    // Dijalankan benar-benar bersamaan, bukan berurutan.
    const [first, second] = await Promise.all([
      request(app).post('/api/bookings').set('Cookie', cookieA).send(payload('DO-RACE-A')),
      request(app).post('/api/bookings').set('Cookie', cookieB).send(payload('DO-RACE-B')),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([201, 409])

    const rejected = first.status === 409 ? first : second
    expect(rejected.body.error.code).toBe('QUOTA_FULL')

    // Kuota tidak boleh terpakai melebihi kapasitas, dan hanya satu booking tercatat.
    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
    })
    expect(slots.every((slot) => slot.used <= slot.capacity)).toBe(true)
    expect(slots.filter((slot) => slot.used === 1)).toHaveLength(2)

    const bookings = await prisma.booking.count()
    expect(bookings).toBe(1)
  })

  it('menolak semua kecuali kapasitas saat banyak booking paralel', async () => {
    // Dua dock -> kapasitas 2. Enam permintaan bersamaan pada blok yang sama.
    const seeded = await seedBase(prisma, {
      docks: activityDocks(2, 'UNLOADING'),
      truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
    })
    const truckTypeId = seeded.truckTypes[0]!.id

    const cookies = await Promise.all([
      loginCookie(app, 'customer1@test.local'),
      loginCookie(app, 'customer2@test.local'),
    ])

    const attempts = Array.from({ length: 6 }, (_, index) =>
      request(app)
        .post('/api/bookings')
        .set('Cookie', cookies[index % 2]!)
        .send({
          bookingDate: TOMORROW(),
          activityType: 'UNLOADING',
          truckTypeId,
          startMinute: 9 * 60,
          referenceDocNo: `DO-BURST-${index}`,
          licensePlate: 'B 2222 BB',
          driverName: 'Supir',
        })
    )

    const responses = await Promise.all(attempts)
    const created = responses.filter((response) => response.status === 201)
    const rejected = responses.filter((response) => response.status === 409)

    expect(created).toHaveLength(2)
    expect(rejected).toHaveLength(4)
    expect(rejected.every((response) => response.body.error.code === 'QUOTA_FULL')).toBe(true)

    const slots = await prisma.slotAllocation.findMany({
      where: { slotDate: new Date(`${TOMORROW()}T00:00:00.000Z`), activity: 'UNLOADING' },
    })
    expect(slots.every((slot) => slot.used <= slot.capacity)).toBe(true)
    expect(await prisma.booking.count()).toBe(2)
  })

  it('memberi nomor urut booking berbeda walau dibuat bersamaan', async () => {
    const seeded = await seedBase(prisma, {
      docks: activityDocks(4, 'UNLOADING'),
      truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
    })
    const truckTypeId = seeded.truckTypes[0]!.id
    const cookies = await Promise.all([
      loginCookie(app, 'customer1@test.local'),
      loginCookie(app, 'customer2@test.local'),
    ])

    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        request(app)
          .post('/api/bookings')
          .set('Cookie', cookies[index % 2]!)
          .send({
            bookingDate: TOMORROW(),
            activityType: 'UNLOADING',
            truckTypeId,
            startMinute: (9 + index) * 60,
            referenceDocNo: `DO-SEQ-${index}`,
            licensePlate: 'B 3333 CC',
            driverName: 'Supir',
          })
      )
    )

    expect(responses.every((response) => response.status === 201)).toBe(true)
    const codes = responses.map((response) => response.body.data.bookingCode as string)
    expect(new Set(codes).size).toBe(4)
    expect(codes.sort()).toEqual([
      `TSB-${TOMORROW().replace(/-/g, '')}-001`,
      `TSB-${TOMORROW().replace(/-/g, '')}-002`,
      `TSB-${TOMORROW().replace(/-/g, '')}-003`,
      `TSB-${TOMORROW().replace(/-/g, '')}-004`,
    ])
  })
})
