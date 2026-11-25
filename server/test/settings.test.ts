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
      footerCompany: null,
      footerLocation: null,
      footerShowLocation: true,
      ticketDesign: 'CLASSIC',
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

  it('menyimpan teks footer dan mengirimnya lewat /api/branding', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const saved = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({
        footerCompany: 'TSB · Time Slot Booking — PT Contoh Indonesia',
        footerLocation: 'Gudang Bekasi · Shift 2',
      })

    expect(saved.status).toBe(200)
    expect(saved.body.data.footerCompany).toBe(
      'TSB · Time Slot Booking — PT Contoh Indonesia'
    )
    expect(saved.body.data.footerLocation).toBe('Gudang Bekasi · Shift 2')

    // Footer dirender di setiap layar yang sudah masuk; halaman tanpa sesi
    // tidak memakainya, tetapi satu sumber data lebih sulit melenceng.
    const branding = await request(app).get('/api/branding')
    expect(branding.body.data.footerCompany).toBe(
      'TSB · Time Slot Booking — PT Contoh Indonesia'
    )
    expect(branding.body.data.footerLocation).toBe('Gudang Bekasi · Shift 2')
  })

  it('mengosongkan teks footer kembali ke null, bukan string kosong', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')
    await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerCompany: 'PT Contoh', footerLocation: 'Shift 2' })

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerCompany: '  ', footerLocation: '' })

    expect(response.status).toBe(200)
    // Null berarti layar memakai teks bawaan yang mengikuti bahasa aktif.
    expect(response.body.data.footerCompany).toBeNull()
    expect(response.body.data.footerLocation).toBeNull()
  })

  it('menolak teks footer yang melebihi lebar kolom', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const company = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerCompany: 'a'.repeat(201) })
    expect(company.status).toBe(400)
    expect(company.body.error.code).toBe('VALIDATION_ERROR')

    const location = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerLocation: 'a'.repeat(121) })
    expect(location.status).toBe(400)
    expect(location.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('menyimpan sakelar baris lokasi footer dan mengirimnya lewat branding', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const off = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerShowLocation: false })
    expect(off.status).toBe(200)
    expect(off.body.data.footerShowLocation).toBe(false)

    // Halaman tanpa sesi (footer ikut dirender di sana) membaca branding, jadi
    // nilainya harus ikut terkirim di endpoint publik itu juga.
    const branding = await request(app).get('/api/branding')
    expect(branding.body.data.footerShowLocation).toBe(false)

    const on = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ footerShowLocation: true })
    expect(on.body.data.footerShowLocation).toBe(true)
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

describe('desain tiket', () => {
  it('menyimpan pilihan desain dan mengirimnya lewat /api/branding', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ ticketDesign: 'NAVY' })

    expect(response.status).toBe(200)
    expect(response.body.data.ticketDesign).toBe('NAVY')
    // Seksi lain tidak boleh ikut berubah karena payload tanpa field-nya.
    expect(response.body.data.warehouseName).toBe('Gudang Tes')

    // Halaman tiket supir tidak punya sesi, jadi desain harus terbaca dari
    // endpoint publik — bukan dari /api/settings yang butuh login.
    const branding = await request(app).get('/api/branding')
    expect(branding.body.data.ticketDesign).toBe('NAVY')
  })

  it('menolak desain di luar tiga pilihan yang punya penggambar', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ ticketDesign: 'FLORAL' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('memakai Klasik sebagai bawaan sebelum ada yang memilih', async () => {
    const branding = await request(app).get('/api/branding')
    expect(branding.body.data.ticketDesign).toBe('CLASSIC')
  })
})

describe('awalan kode booking', () => {
  it('menyimpan awalan baru dan memakainya untuk kode berikutnya', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ bookingCodePrefix: 'tkt' })

    // Huruf kecil dirapikan, bukan ditolak: Admin tidak perlu tahu bedanya.
    expect(response.status).toBe(200)
    expect(response.body.data.bookingCodePrefix).toBe('TKT')

    // Bukti sebenarnya: kode yang terbit memakai awalan baru.
    const customer = await loginCookie(app, 'customer1@test.local')
    const booking = await request(app)
      .post('/api/bookings')
      .set('Cookie', customer)
      .send({
        bookingDate: addDaysISO(todayISO(), 3),
        startMinute: 540,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
        referenceDocNo: 'DO-PREFIX-001',
        licensePlate: 'B 1234 TKT',
        driverName: 'Supir Uji',
      })

    expect(booking.status).toBe(201)
    expect(booking.body.data.bookingCode).toMatch(/^TKT-\d{8}-\d{3}$/)
  })

  it('menolak awalan yang bentuknya salah', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    for (const bad of ['TS', 'TSBX', 'T-B', 'TS B', '']) {
      const response = await request(app)
        .put('/api/settings')
        .set('Cookie', cookie)
        .send({ bookingCodePrefix: bad })

      expect(response.status, `awalan "${bad}" seharusnya ditolak`).toBe(400)
    }
  })

  it('tidak mengubah kode yang sudah ada saat awalan diganti', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    // Satu booking dengan awalan lama, dibuat sebelum pengaturan diubah.
    const customer = await loginCookie(app, 'customer1@test.local')
    const before = await request(app)
      .post('/api/bookings')
      .set('Cookie', customer)
      .send({
        bookingDate: addDaysISO(todayISO(), 4),
        startMinute: 540,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
        referenceDocNo: 'DO-PREFIX-002',
        licensePlate: 'B 5678 LMA',
        driverName: 'Supir Lama',
      })
    expect(before.body.data.bookingCode).toMatch(/^TSB-/)

    await request(app).put('/api/settings').set('Cookie', cookie).send({
      bookingCodePrefix: 'TKT',
    })

    // Tiket yang sudah tercetak tetap hidup: kodenya tidak ditulis ulang.
    const after = await prisma.booking.findUniqueOrThrow({
      where: { id: before.body.data.id },
      select: { bookingCode: true },
    })
    expect(after.bookingCode).toBe(before.body.data.bookingCode)
  })
})
