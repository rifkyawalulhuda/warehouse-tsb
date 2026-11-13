import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import ExcelJS from 'exceljs'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

let seed: Awaited<ReturnType<typeof seedBase>>

beforeEach(async () => {
  await resetDatabase(prisma)
  seed = await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Booking satu baris, dibuat langsung supaya tidak bergantung aturan pembuatan. */
async function seedBooking(startTime: Date) {
  return prisma.booking.create({
    data: {
      bookingCode: 'TSB-20261113-001',
      referenceDocNo: 'REF-LAPORAN',
      qrToken: 'LaporanStaffToken001',
      customerId: seed.customerA.id,
      createdById: seed.customer.id,
      activityType: 'UNLOADING',
      truckTypeId: seed.truckTypes[0]!.id,
      bookingDate: dateOnlyToUtc('2026-11-13'),
      startTime,
      endTime: new Date(startTime.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: 'CHECKED_OUT',
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
    },
  })
}

const DAY = '2026-11-13'

describe('laporan staf', () => {
  it('menolak tanggal yang bentuknya benar tetapi tidak ada', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .get(`/api/reports/kpi?from=2026-13-45&to=${DAY}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('menolak rentang yang melewati batas hari', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .get('/api/reports/kpi?from=2020-01-01&to=2026-11-13')
      .set('Cookie', cookie)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('menulis waktu di Excel dengan bentuk yang bisa diurutkan', async () => {
    await seedBooking(new Date('2026-11-13T02:00:00.000Z'))
    const cookie = await loginCookie(app, 'admin@test.local')

    const response = await request(app)
      .get(`/api/reports/export.xlsx?from=${DAY}&to=${DAY}`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })

    expect(response.status).toBe(200)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(response.body as Buffer)
    const sheet = workbook.getWorksheet('Detail Booking')!
    // Kolom dibaca lewat nomor: kunci kolom tidak ikut tersimpan di berkas.
    const row = sheet.getRow(2)

    expect(row.getCell(1).value).toBe('TSB-20261113-001')
    expect(row.getCell(8).value).toBe('2026-11-13 09:00')
  })
})
