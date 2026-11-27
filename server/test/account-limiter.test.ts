import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { loginCookie, resetDatabase, seedBase, TEST_PASSWORD } from './helpers'

/**
 * `accountLimiter` adalah penjaga terakhir bila cookie sesi dicuri: tanpa
 * pembatas, penyerang bisa menebak kata sandi lewat `PATCH /account/password`
 * tanpa batas, dan tebakan yang berhasil justru mengunci pemilik aslinya.
 *
 * Berkas terpisah karena penyimpanan pembatas bersifat module-level: menabrak
 * batas di berkas yang sama akan membuat tes lain di berkas itu ikut 429.
 */
const prisma = new PrismaClient()
const app = createApp()

/** Kata sandi yang jelas bukan milik akun mana pun di seed. */
const WRONG_PASSWORD = `${TEST_PASSWORD}-salah`

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('accountLimiter', () => {
  it('membatasi tebakan kata sandi lewat ganti kata sandi', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const attempt = () =>
      request(app)
        .patch('/api/account/password')
        .set('Cookie', cookie)
        .send({ currentPassword: WRONG_PASSWORD, newPassword: 'kata-sandi-baru-123' })

    for (let index = 0; index < 10; index += 1) {
      // Salah kata sandi dijawab 400 INVALID_PASSWORD, bukan 401: klien
      // memperlakukan 401 sebagai sesi berakhir dan melempar pengguna keluar.
      const response = await attempt()
      expect(response.status, `percobaan ${index + 1}`).toBe(400)
      expect(response.body.error.code).toBe('INVALID_PASSWORD')
    }

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('TOO_MANY_PASSWORD_ATTEMPTS')
  })
})
