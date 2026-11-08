import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

let adminCookie: string
let customerCookie: string
let truckTypeId: number

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {})
  adminCookie = await loginCookie(app, seeded.admin.email)
  customerCookie = await loginCookie(app, seeded.customer.email)
  truckTypeId = seeded.truckTypes[0]!.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('master: jenis truk', () => {
  it('hanya menerima ADMIN', async () => {
    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', customerCookie)
      .send({ truckName: 'Seharusnya Ditolak' })

    expect(response.status).toBe(403)
  })

  it('mengubah data dan menurunkan jumlah blok dari durasi baru', async () => {
    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', adminCookie)
      .send({ truckName: 'CDD Panjang', durationMinutes: 90, sortOrder: 5 })

    expect(response.status).toBe(200)
    expect(response.body.data.truckName).toBe('CDD Panjang')
    expect(response.body.data.durationMinutes).toBe(90)
    expect(response.body.data.sortOrder).toBe(5)
    // ceil(90/30) = 3. Angka ini dihitung server, bukan dipercaya dari klien.
    expect(response.body.data.blocksRequired).toBe(3)
  })

  it('mengabaikan blocksRequired yang dikirim klien', async () => {
    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', adminCookie)
      .send({ blocksRequired: 1 })

    expect(response.status).toBe(200)
    // Durasi tidak ikut diubah, jadi blok tetap mengikuti durasi lama (60 -> 2).
    expect(response.body.data.blocksRequired).toBe(2)
  })

  it('mempertahankan blok saat hanya nama yang diubah', async () => {
    const before = await prisma.truckType.findUnique({ where: { id: truckTypeId } })

    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', adminCookie)
      .send({ truckName: 'Nama Baru Saja' })

    expect(response.status).toBe(200)
    expect(response.body.data.durationMinutes).toBe(before?.durationMinutes)
    expect(response.body.data.blocksRequired).toBe(before?.blocksRequired)
  })

  it('menonaktifkan jenis truk tetap terlihat di master dan hilang dari settings', async () => {
    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })

    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(false)

    // Harus tetap muncul di halaman master supaya bisa diaktifkan kembali.
    const list = await request(app)
      .get('/api/master/truck-types')
      .set('Cookie', adminCookie)
    expect(list.body.data.some((type: { id: number }) => type.id === truckTypeId)).toBe(true)

    // Tapi tidak lagi ditawarkan ke form booking baru.
    const settings = await request(app).get('/api/settings').set('Cookie', customerCookie)
    expect(
      settings.body.data.truckTypes.some((type: { id: number }) => type.id === truckTypeId)
    ).toBe(false)
  })

  it('menolak durasi di luar batas', async () => {
    const response = await request(app)
      .patch(`/api/master/truck-types/${truckTypeId}`)
      .set('Cookie', adminCookie)
      .send({ durationMinutes: 5 })

    expect(response.status).toBe(400)
  })
})

describe('master: gudang dan area dock', () => {
  it('hanya menerima ADMIN', async () => {
    const response = await request(app)
      .post('/api/master/warehouses')
      .set('Cookie', customerCookie)
      .send({ name: 'Gudang Baru' })

    expect(response.status).toBe(403)
  })

  it('membaca daftar gudang beserta jumlah docknya', async () => {
    const response = await request(app)
      .get('/api/master/warehouses')
      .set('Cookie', adminCookie)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Gudang Tes')
    expect(response.body.data[0]._count.docks).toBe(1)
  })

  it('menambah gudang dan menolak nama yang sudah dipakai', async () => {
    const created = await request(app)
      .post('/api/master/warehouses')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Timur' })

    expect(created.status).toBe(201)
    expect(created.body.data.name).toBe('Gudang Timur')

    const duplicate = await request(app)
      .post('/api/master/warehouses')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Timur' })

    expect(duplicate.status).toBe(409)
  })

  it('mengubah nama area dan memindahkan dock ke gudang lain', async () => {
    const target = await prisma.warehouse.create({ data: { name: 'Gudang Kedua' } })
    const dock = await prisma.dock.findFirstOrThrow()

    const response = await request(app)
      .patch(`/api/master/docks/${dock.id}`)
      .set('Cookie', adminCookie)
      .send({ areaName: 'Area B', warehouseId: target.id })

    expect(response.status).toBe(200)
    expect(response.body.data.areaName).toBe('Area B')
    expect(response.body.data.warehouse).toEqual({ id: target.id, name: 'Gudang Kedua' })
  })

  it('mengosongkan nama area dengan mengirim null', async () => {
    const dock = await prisma.dock.findFirstOrThrow()
    await prisma.dock.update({ where: { id: dock.id }, data: { areaName: 'Area Lama' } })

    const response = await request(app)
      .patch(`/api/master/docks/${dock.id}`)
      .set('Cookie', adminCookie)
      .send({ areaName: null })

    expect(response.status).toBe(200)
    expect(response.body.data.areaName).toBeNull()
  })

  it('menolak pindah ke gudang yang tidak ada', async () => {
    const dock = await prisma.dock.findFirstOrThrow()

    const response = await request(app)
      .patch(`/api/master/docks/${dock.id}`)
      .set('Cookie', adminCookie)
      .send({ warehouseId: 9999 })

    expect(response.status).toBe(404)
  })

  it('menyinkronkan nama gudang pertama dengan pengaturan', async () => {
    const list = await request(app)
      .get('/api/master/warehouses')
      .set('Cookie', adminCookie)
    const firstId = list.body.data[0].id as number

    const renamed = await request(app)
      .patch(`/api/master/warehouses/${firstId}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Utara' })

    expect(renamed.status).toBe(200)

    // Nama ini juga tercetak di tiket supir, jadi keduanya harus ikut berubah.
    const settings = await request(app).get('/api/settings').set('Cookie', adminCookie)
    expect(settings.body.data.warehouseName).toBe('Gudang Utara')
  })

  it('tidak mematikan gudang yang masih berisi dock', async () => {
    const list = await request(app)
      .get('/api/master/warehouses')
      .set('Cookie', adminCookie)
    const firstId = list.body.data[0].id as number

    const response = await request(app)
      .patch(`/api/master/warehouses/${firstId}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })

    expect(response.status).toBe(409)
  })
})
