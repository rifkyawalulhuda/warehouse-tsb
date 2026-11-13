import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { loginCookie, resetDatabase, seedBase } from './helpers'

/**
 * Angka perencanaan gudang — kapasitas per blok, jumlah blok per hari, sisa
 * kapasitas per slot — hanya milik staf. Aturan yang sama sudah dipakai pada
 * laporan customer; berkas ini memastikannya juga berlaku pada dua endpoint
 * yang dipakai layar booking.
 */
const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('pengaturan yang diterima customer', () => {
  it('tidak memuat kapasitas gudang maupun jumlah blok per hari', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')

    const response = await request(app).get('/api/settings').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data).not.toHaveProperty('capacity')
    expect(response.body.data).not.toHaveProperty('blocksPerDay')
  })

  it('tetap memuat yang dibutuhkan layar booking', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')

    const response = await request(app).get('/api/settings').set('Cookie', cookie)
    const data = response.body.data

    expect(data.warehouseName).toBeTruthy()
    expect(data.operatingStartLabel).toMatch(/^\d{2}:\d{2}$/)
    expect(data.slotUnitMinutes).toBeGreaterThan(0)
    expect(data.bookingWindowDays).toBeGreaterThan(0)
    expect(data.truckTypes.length).toBeGreaterThan(0)
  })

  it('staf tetap menerima kapasitas dan jumlah blok per hari', async () => {
    const cookie = await loginCookie(app, 'gate@test.local')

    const response = await request(app).get('/api/settings').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.capacity).toEqual({
      LOADING: expect.any(Number),
      UNLOADING: expect.any(Number),
    })
    expect(response.body.data.blocksPerDay).toBeGreaterThan(0)
  })
})

describe('ketersediaan slot yang diterima customer', () => {
  it('menyebut sisa slot tanpa membocorkan kapasitas per blok', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')
    const truckType = await prisma.truckType.findFirstOrThrow({ where: { isActive: true } })
    const date = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const response = await request(app)
      .get('/api/bookings/slots/availability')
      .query({ date, activity: 'UNLOADING', truckTypeId: truckType.id })
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data).not.toHaveProperty('capacity')

    const slots = response.body.data.slots as Record<string, unknown>[]
    expect(slots.length).toBeGreaterThan(0)
    for (const slot of slots) {
      expect(slot).not.toHaveProperty('capacity')
      expect(slot).toHaveProperty('remaining')
      expect(slot).toHaveProperty('status')
    }
  })
})
