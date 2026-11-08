import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { loginCookie, resetDatabase, seedBase, TEST_PASSWORD } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

let adminCookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
  adminCookie = await loginCookie(app, 'admin@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

function profile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'PT Contoh Baru',
    address: 'Jl. Industri 1',
    city: 'Cikarang',
    picName: 'Pak Andi',
    phone: '081200000009',
    email: 'ops@contoh.co.id',
    taxId: '01.234.567.8-901.000',
    note: 'Termin 30 hari',
    ...overrides,
  }
}

describe('Master Data Customer', () => {
  it('membuat customer dengan kode otomatis berurutan', async () => {
    const first = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile({ name: 'PT Satu' }))
    expect(first.status).toBe(201)
    expect(first.body.data.code).toMatch(/^CUST-\d{3}$/)

    const second = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile({ name: 'PT Dua' }))
    expect(second.status).toBe(201)

    const firstNumber = Number(first.body.data.code.split('-')[1])
    const secondNumber = Number(second.body.data.code.split('-')[1])
    expect(secondNumber).toBe(firstNumber + 1)
  })

  it('menolak nama perusahaan duplikat tanpa memandang huruf besar/kecil', async () => {
    await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile({ name: 'PT Sinar Jaya Logistik' }))

    // Sudah ada dari seed dengan ejaan sama; coba ejaan berbeda kapital.
    const dup = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile({ name: 'pt sinar jaya logistik' }))

    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('CUSTOMER_NAME_TAKEN')
  })

  it('mengubah profil dan mencatat audit', async () => {
    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile())

    const updated = await request(app)
      .patch(`/api/customers/${created.body.data.id}`)
      .set('Cookie', adminCookie)
      .send({ city: 'Bekasi' })

    expect(updated.status).toBe(200)
    expect(updated.body.data.city).toBe('Bekasi')

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CUSTOMER_UPDATED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
  })

  it('mencatat audit terpisah saat whitelist approval diubah', async () => {
    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile())

    await request(app)
      .patch(`/api/customers/${created.body.data.id}`)
      .set('Cookie', adminCookie)
      .send({ autoApproveBooking: true })

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CUSTOMER_APPROVAL_FLAG_CHANGED' },
    })
    expect(audit).not.toBeNull()
  })

  it('menonaktifkan customer membuat akunnya gagal booking', async () => {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { name: 'PT Alpha Logistik' },
    })
    const cookie = await loginCookie(app, 'customer1@test.local')

    const deactivated = await request(app)
      .patch(`/api/customers/${customer.id}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
    expect(deactivated.status).toBe(200)

    const truckType = await prisma.truckType.findFirstOrThrow()
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const booking = await request(app)
      .post('/api/bookings')
      .set('Cookie', cookie)
      .send({
        bookingDate: tomorrow,
        activityType: 'UNLOADING',
        truckTypeId: truckType.id,
        startMinute: 9 * 60,
        referenceDocNo: 'DO-INACTIVE',
        licensePlate: 'B 1234 XX',
        driverName: 'Supir',
      })

    expect(booking.status).toBe(409)
    expect(booking.body.error.code).toBe('CUSTOMER_INACTIVE')
  })

  it('menghapus customer yang kosong', async () => {
    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send(profile())

    const deleted = await request(app)
      .delete(`/api/customers/${created.body.data.id}`)
      .set('Cookie', adminCookie)

    expect(deleted.status).toBe(200)
    const still = await prisma.customer.findUnique({ where: { id: created.body.data.id } })
    expect(still).toBeNull()
  })

  it('menolak menghapus customer yang masih punya akun', async () => {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { name: 'PT Alpha Logistik' },
    })

    const deleted = await request(app)
      .delete(`/api/customers/${customer.id}`)
      .set('Cookie', adminCookie)

    expect(deleted.status).toBe(409)
    expect(deleted.body.error.code).toBe('CUSTOMER_IN_USE')
  })
})

describe('akun login di dalam customer', () => {
  it('membuat akun CUSTOMER yang otomatis tertaut ke perusahaannya', async () => {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { name: 'PT Alpha Logistik' },
    })

    const created = await request(app)
      .post(`/api/customers/${customer.id}/users`)
      .set('Cookie', adminCookie)
      .send({
        name: 'Staf Baru',
        email: 'staf.baru@alpha.test',
        password: TEST_PASSWORD,
      })

    expect(created.status).toBe(201)

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: 'staf.baru@alpha.test' },
      select: { role: true, customerId: true },
    })
    expect(stored.role).toBe('CUSTOMER')
    expect(stored.customerId).toBe(customer.id)

    // Akun itu benar-benar bisa login.
    const cookie = await loginCookie(app, 'staf.baru@alpha.test')
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(me.status).toBe(200)
    expect(me.body.data.customerId).toBe(customer.id)
  })

  it('menolak menambah akun ke customer yang nonaktif', async () => {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { name: 'PT Alpha Logistik' },
    })
    await prisma.customer.update({ where: { id: customer.id }, data: { isActive: false } })

    const created = await request(app)
      .post(`/api/customers/${customer.id}/users`)
      .set('Cookie', adminCookie)
      .send({ name: 'Staf Baru', email: 'staf2@alpha.test', password: TEST_PASSWORD })

    expect(created.status).toBe(409)
    expect(created.body.error.code).toBe('CUSTOMER_INACTIVE')
  })

  it('tidak bisa mengubah akun milik customer lain lewat jalur ini', async () => {
    const alpha = await prisma.customer.findUniqueOrThrow({
      where: { name: 'PT Alpha Logistik' },
    })
    const betaUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'customer2@test.local' },
    })

    const response = await request(app)
      .patch(`/api/customers/${alpha.id}/users/${betaUser.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Coba Serobot' })

    expect(response.status).toBe(404)
  })
})

describe('POST /api/users tidak lagi membuat akun customer', () => {
  it('menolak role CUSTOMER dengan pesan yang menunjuk Master Data', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Customer Baru',
        email: 'customer.baru@test.local',
        role: 'CUSTOMER',
        password: TEST_PASSWORD,
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('CUSTOMER_VIA_MASTER')
  })

  it('daftar pengguna tidak memuat akun customer', async () => {
    const response = await request(app).get('/api/users').set('Cookie', adminCookie)
    expect(response.status).toBe(200)

    const roles = response.body.data.map((user: { role: string }) => user.role)
    expect(roles).not.toContain('CUSTOMER')
  })

  it('tetap bisa membuat akun non-customer', async () => {
    const response = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Checker Baru',
        email: 'checker.baru@test.local',
        role: 'CHECKER',
        password: TEST_PASSWORD,
      })

    expect(response.status).toBe(201)
    expect(response.body.data.role).toBe('CHECKER')
  })
})
