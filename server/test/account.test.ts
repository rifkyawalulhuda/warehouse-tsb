import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { loginCookie, resetDatabase, seedBase, TEST_PASSWORD } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

/** Kata sandi yang jelas bukan milik akun mana pun di seed. */
const WRONG_PASSWORD = 'salah-sekali-123'

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('profil akun', () => {
  it('mengirim nomor HP di /auth/me supaya form profil bisa terisi', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')
    await prisma.user.update({
      where: { email: 'admin@test.local' },
      data: { phone: '081200001111' },
    })

    const response = await request(app).get('/api/auth/me').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.phone).toBe('081200001111')
  })

  it('menyimpan nama dan nomor HP, dan mengosongkan nomor dengan string kosong', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const filled = await request(app)
      .patch('/api/account/profile')
      .set('Cookie', cookie)
      .send({ name: 'Admin Baru', phone: '0812 3456 7890' })

    expect(filled.status).toBe(200)
    expect(filled.body.data).toMatchObject({
      name: 'Admin Baru',
      phone: '0812 3456 7890',
    })

    const cleared = await request(app)
      .patch('/api/account/profile')
      .set('Cookie', cookie)
      .send({ phone: '' })

    // String kosong harus benar-benar jadi null; menyimpannya sebagai ''
    // membuat "nomor kosong" punya dua wujud di database.
    expect(cleared.body.data.phone).toBeNull()
    expect(cleared.body.data.name).toBe('Admin Baru')
  })

  it('menolak nama terlalu pendek tanpa menyentuh database', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/profile')
      .set('Cookie', cookie)
      .send({ name: 'A' })

    expect(response.status).toBe(400)
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@test.local' },
    })
    expect(user.name).not.toBe('A')
  })

  it('hanya mengubah akun pemilik sesi, bukan akun lain', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    await request(app)
      .patch('/api/account/profile')
      .set('Cookie', cookie)
      .send({ name: 'Hanya Saya' })

    // Staf lain di seed tidak boleh ikut berubah.
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: 'gate@test.local' },
    })
    expect(other.name).not.toBe('Hanya Saya')
  })
})

describe('ganti email', () => {
  it('menolak kata sandi yang salah dengan 400, bukan 401', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/email')
      .set('Cookie', cookie)
      .send({ email: 'baru@test.local', currentPassword: WRONG_PASSWORD })

    // 401 akan dibaca klien sebagai "sesi berakhir" dan melempar pengguna ke
    // halaman masuk — padahal ia hanya salah mengetik kata sandi.
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_PASSWORD')
  })

  it('menolak email yang sudah dipakai akun lain', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/email')
      .set('Cookie', cookie)
      .send({ email: 'gate@test.local', currentPassword: TEST_PASSWORD })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('menolak email yang sama persis', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/email')
      .set('Cookie', cookie)
      .send({ email: 'admin@test.local', currentPassword: TEST_PASSWORD })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('EMAIL_UNCHANGED')
  })

  it('mengganti email dan mengeluarkan perangkat lain tetapi bukan sesi ini', async () => {
    const first = await loginCookie(app, 'admin@test.local')
    const second = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/email')
      .set('Cookie', second)
      .send({ email: 'admin-baru@test.local', currentPassword: TEST_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body.data.email).toBe('admin-baru@test.local')

    // Perangkat yang meminta perubahan tetap masuk...
    const mine = await request(app).get('/api/account').set('Cookie', second)
    expect(mine.status).toBe(200)

    // ...perangkat lain tidak. Sesi pertama harus gagal memperpanjang.
    const other = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', first)
    expect(other.status).toBe(401)
  })
})

describe('ganti kata sandi', () => {
  const NEW_PASSWORD = 'kata-sandi-baru-9'

  it('menolak kata sandi sekarang yang salah', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/password')
      .set('Cookie', cookie)
      .send({ currentPassword: WRONG_PASSWORD, newPassword: NEW_PASSWORD })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_PASSWORD')
  })

  it('menolak kata sandi baru yang sama dengan yang sekarang', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/password')
      .set('Cookie', cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('PASSWORD_UNCHANGED')
  })

  it('menolak kata sandi baru yang terlalu pendek', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/password')
      .set('Cookie', cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'pendek' })

    expect(response.status).toBe(400)
  })

  it('mengganti kata sandi, mengeluarkan perangkat lain, dan tetap mengizinkan sesi ini', async () => {
    const first = await loginCookie(app, 'admin@test.local')
    const second = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .patch('/api/account/password')
      .set('Cookie', second)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body.data.revoked).toBe(1)
    expect(response.body.data.activeSessions).toBe(1)

    const mine = await request(app).get('/api/account').set('Cookie', second)
    expect(mine.status).toBe(200)

    const other = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', first)
    expect(other.status).toBe(401)

    // Kata sandi baru benar-benar dipakai untuk masuk berikutnya. Sesi lama
    // sudah dicabut, jadi login baru harus membuat sesi baru yang sah.
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: NEW_PASSWORD })
    expect(relogin.status).toBe(200)
  })
})

describe('perangkat & sesi', () => {
  it('menghitung sesi aktif dan bisa mengeluarkan yang lain', async () => {
    const first = await loginCookie(app, 'admin@test.local')
    await loginCookie(app, 'admin@test.local')

    const before = await request(app).get('/api/account').set('Cookie', first)
    expect(before.body.data.activeSessions).toBe(2)

    const revoke = await request(app)
      .post('/api/account/sessions/revoke-others')
      .set('Cookie', first)

    expect(revoke.status).toBe(200)
    expect(revoke.body.data.revoked).toBe(1)
    expect(revoke.body.data.activeSessions).toBe(1)

    const mine = await request(app).get('/api/account').set('Cookie', first)
    expect(mine.status).toBe(200)
  })

  it('menolak permintaan tanpa sesi', async () => {
    const response = await request(app).get('/api/account')
    expect(response.status).toBe(401)
  })

  it('dipakai juga oleh akun customer', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')

    const response = await request(app).get('/api/account').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.role).toBe('CUSTOMER')
    expect(response.body.data.customerName).toBe('PT Alpha Logistik')
  })
})