import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { dateOnlyToUtc, jakartaInstant, todayISO, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

let adminCookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Booking siap ditugaskan dock, milik customer tertentu. */
async function seedBooking(customerId: string, truckTypeId: number) {
  // Customer baru dari API belum punya akun login; pembuat booking cukup
  // admin, karena yang diuji adalah area dock, bukan kepemilikan.
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
  const start = jakartaInstant(todayISO(), 9 * 60)
  return prisma.booking.create({
    data: {
      bookingCode: `T-${Math.random().toString(36).slice(2, 8)}`,
      referenceDocNo: 'REF-TEST',
      qrToken: Math.random().toString(36).slice(2).padEnd(32, '0'),
      customerId,
      createdById: admin.id,
      activityType: 'UNLOADING',
      truckTypeId,
      bookingDate: dateOnlyToUtc(utcToDateOnly(start)),
      startTime: start,
      endTime: new Date(start.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: 'CHECKED_IN_ON_TIME',
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

/** Dua gudang, satu dock UNLOADING di masing-masing. */
async function seedTwoWarehouses() {
  const seed = await seedBase(prisma, {
    warehouses: ['Gudang WH2'],
    docks: [
      { dockCode: 'D1', allowedActivity: 'UNLOADING' },
      { dockCode: 'D2', allowedActivity: 'UNLOADING', warehouseName: 'Gudang WH2' },
    ],
  })
  adminCookie = await loginCookie(app, 'admin@test.local')
  return seed
}

describe('area dock per customer', () => {
  it('menyimpan pilihan gudang dan mengirimnya kembali', async () => {
    const seed = await seedTwoWarehouses()
    const wh2 = seed.warehouses.find((row) => row.name === 'Gudang WH2')!

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Mitra Niaga', warehouseIds: [wh2.id] })

    expect(created.status).toBe(201)
    expect(created.body.data.warehouses).toEqual([{ id: wh2.id, name: 'Gudang WH2' }])

    const fetched = await request(app)
      .get(`/api/customers/${created.body.data.id}`)
      .set('Cookie', adminCookie)
    expect(fetched.body.data.warehouses).toEqual([
      { id: wh2.id, name: 'Gudang WH2' },
    ])
  })

  it('daftar gudang kosong berarti semua gudang boleh dipakai', async () => {
    const seed = await seedTwoWarehouses()

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Bebas Area', warehouseIds: [] })

    expect(created.status).toBe(201)
    expect(created.body.data.warehouses).toEqual([])

    const booking = await seedBooking(created.body.data.id, seed.truckTypes[0]!.id)
    const checker = await loginCookie(app, 'checker@test.local')

    // Dock di gudang mana pun boleh ditugaskan.
    for (const dock of seed.docks) {
      const response = await request(app)
        .post('/api/ops/assign-dock')
        .set('Cookie', checker)
        .send({ bookingId: booking.id, dockId: dock.id })
      expect(response.status).toBe(200)
      await prisma.booking.update({
        where: { id: booking.id },
        data: { assignedDockId: null, status: 'CHECKED_IN_ON_TIME' },
      })
      await prisma.dock.update({
        where: { id: dock.id },
        data: { currentStatus: 'AVAILABLE' },
      })
    }
  })

  it('menolak dock di luar area customer yang dibatasi', async () => {
    const seed = await seedTwoWarehouses()
    const wh1 = seed.warehouses.find((row) => row.name === 'Gudang Tes')!

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Mitra Niaga', warehouseIds: [wh1.id] })

    const booking = await seedBooking(created.body.data.id, seed.truckTypes[0]!.id)
    const checker = await loginCookie(app, 'checker@test.local')

    const allowed = seed.docks.find((dock) => dock.dockCode === 'D1')!
    const forbidden = seed.docks.find((dock) => dock.dockCode === 'D2')!

    const rejected = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checker)
      .send({ bookingId: booking.id, dockId: forbidden.id })

    expect(rejected.status).toBe(409)
    expect(rejected.body.error.code).toBe('DOCK_WAREHOUSE_FORBIDDEN')
    // Dock tidak boleh terkunci gara-gara penolakan.
    const untouched = await prisma.dock.findUniqueOrThrow({
      where: { id: forbidden.id },
    })
    expect(untouched.currentStatus).toBe('AVAILABLE')

    const accepted = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checker)
      .send({ bookingId: booking.id, dockId: allowed.id })
    expect(accepted.status).toBe(200)
  })

  it('menandai dock luar area di hasil pindai tanpa menyembunyikannya', async () => {
    const seed = await seedTwoWarehouses()
    const wh1 = seed.warehouses.find((row) => row.name === 'Gudang Tes')!

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Mitra Niaga', warehouseIds: [wh1.id] })

    const booking = await seedBooking(created.body.data.id, seed.truckTypes[0]!.id)
    const checker = await loginCookie(app, 'checker@test.local')

    const response = await request(app)
      .get(`/api/ops/checker/scan/${booking.qrToken}`)
      .set('Cookie', checker)

    expect(response.status).toBe(200)
    const docks = response.body.data.docks as Array<{
      dockCode: string
      eligible: boolean
      allowedWarehouse: boolean
    }>

    // Kedua dock tetap dikirim: checker perlu bisa menjelaskan ke supir bahwa
    // gudangnya ada, hanya bukan area customer ini.
    expect(docks.map((dock) => dock.dockCode).sort()).toEqual(['D1', 'D2'])
    const d1 = docks.find((dock) => dock.dockCode === 'D1')!
    const d2 = docks.find((dock) => dock.dockCode === 'D2')!
    expect(d1).toMatchObject({ eligible: true, allowedWarehouse: true })
    expect(d2).toMatchObject({ eligible: false, allowedWarehouse: false })
  })

  it('mengubah area mencatat audit tersendiri', async () => {
    const seed = await seedTwoWarehouses()
    const wh2 = seed.warehouses.find((row) => row.name === 'Gudang WH2')!

    const created = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Mitra Niaga' })

    await request(app)
      .patch(`/api/customers/${created.body.data.id}`)
      .set('Cookie', adminCookie)
      .send({ warehouseIds: [wh2.id] })

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'CUSTOMER_WAREHOUSES_CHANGED' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit!.meta).toMatchObject({
      customerId: created.body.data.id,
      warehouseIds: [wh2.id],
    })
  })

  it('menolak gudang yang tidak ada', async () => {
    await seedBase(prisma)
    adminCookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({ name: 'CV Salah Gudang', warehouseIds: [999_999] })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('WAREHOUSE_NOT_FOUND')
  })
})
