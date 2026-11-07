import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
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

describe('PUT /api/settings', () => {
  /**
   * Regresi: rute ini dulu dipasang tanpa requireAuth sehingga `req.user` kosong
   * dan setiap admin mendapat 401 saat menyimpan pengaturan.
   */
  it('menyimpan pengaturan atas nama admin yang login', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ warehouseName: 'Gudang Baru', gracePeriodMinutes: 20 })

    expect(response.status).toBe(200)
    expect(response.body.data.warehouseName).toBe('Gudang Baru')
    expect(response.body.data.gracePeriodMinutes).toBe(20)
  })

  it('menolak customer yang mencoba mengubah pengaturan', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ warehouseName: 'Gudang Ilegal' })

    expect(response.status).toBe(403)
  })

  it('menolak permintaan tanpa sesi', async () => {
    const response = await request(app).put('/api/settings').send({ warehouseName: 'X' })

    expect(response.status).toBe(401)
  })
})
