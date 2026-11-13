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

describe('nama aplikasi', () => {
  it('menyimpan judul, subjudul, dan nama pendek', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({
        appName: 'TSB Dock',
        appTagline: 'Antrean Gudang',
        appShortName: 'TSB',
      })

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      appName: 'TSB Dock',
      appTagline: 'Antrean Gudang',
      appShortName: 'TSB',
      // Seksi lain tidak boleh ikut berubah karena payload tanpa field-nya.
      warehouseName: 'Gudang Tes',
    })

    const branding = await request(app).get('/api/branding')
    // `/api/branding` juga mengirim kolom merek dan halaman login. Nilainya null
    // di tes ini karena tidak pernah diisi, tetapi kolomnya wajib ada.
    expect(branding.body.data).toEqual({
      appName: 'TSB Dock',
      appTagline: 'Antrean Gudang',
      appShortName: 'TSB',
      appLogoUrl: null,
      loginDescription: null,
      loginCoverUrl: null,
      loginBrandColor: null,
    })
  })

  it('menyimpan nama pendek kosong sebagai null, bukan string kosong', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appName: 'TSB Dock', appShortName: 'TSB' })

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appShortName: '   ' })

    expect(response.status).toBe(200)
    expect(response.body.data.appShortName).toBeNull()
    expect(response.body.data.appName).toBe('TSB Dock')
  })

  it('menyimpan logo dan teks sambutan halaman masuk', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({
        appLogoUrl: ' /api/uploads/app-logo-1.png ',
        loginDescription: '  Bongkar lebih cepat.  ',
      })

    expect(response.status).toBe(200)
    expect(response.body.data.appLogoUrl).toBe('/api/uploads/app-logo-1.png')
    expect(response.body.data.loginDescription).toBe('Bongkar lebih cepat.')

    // Halaman masuk membacanya tanpa sesi; nilainya harus ikut terkirim.
    const branding = await request(app).get('/api/branding')
    expect(branding.body.data.appLogoUrl).toBe('/api/uploads/app-logo-1.png')
    expect(branding.body.data.loginDescription).toBe('Bongkar lebih cepat.')
  })

  it('mengosongkan logo dan teks sambutan kembali ke null', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')
    await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({
        appLogoUrl: '/api/uploads/app-logo-1.png',
        loginDescription: 'Halo',
      })

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appLogoUrl: '   ', loginDescription: '   ' })

    expect(response.status).toBe(200)
    // Null, bukan string kosong: layar masuk memakai null sebagai penanda
    // "pakai teks dan lencana bawaan".
    expect(response.body.data.appLogoUrl).toBeNull()
    expect(response.body.data.loginDescription).toBeNull()
  })

  it('menolak logo yang bukan unggahan sendiri atau http(s)', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    // Nilai ini dirender di halaman tanpa sesi, jadi skema seperti javascript:
    // tidak boleh lolos.
    const unsafe = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appLogoUrl: 'javascript:alert(1)' })

    expect(unsafe.status).toBe(400)
    expect(unsafe.body.error.code).toBe('VALIDATION_ERROR')

    const remote = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appLogoUrl: 'https://cdn.contoh.test/logo.png' })
    expect(remote.status).toBe(200)
  })

  it('menolak judul kosong dan teks melebihi kolom database', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')
    // Kesalahan validasi skema di proyek ini dikirim sebagai 400
    // VALIDATION_ERROR (lihat middleware/error.ts), bukan 422.
    const invalid = { status: 400, code: 'VALIDATION_ERROR' }

    const empty = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appName: '   ' })
    expect(empty.status).toBe(invalid.status)
    expect(empty.body.error.code).toBe(invalid.code)

    const long = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appName: 'a'.repeat(61) })
    expect(long.status).toBe(invalid.status)

    const shortLong = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appShortName: 'a'.repeat(21) })
    expect(shortLong.status).toBe(invalid.status)
  })

  it('menolak perubahan nama aplikasi oleh selain admin', async () => {
    const cookie = await loginCookie(app, 'customer1@test.local')
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appName: 'Diambil Alih' })

    expect(response.status).toBe(403)
  })

  it('halaman masuk bisa membaca judul tanpa sesi', async () => {
    const response = await request(app).get('/api/branding')
    expect(response.status).toBe(200)
    expect(response.body.data.appName).toBe('Warehouse TSB')
  })
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
