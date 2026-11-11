import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import ExcelJS from 'exceljs'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import {
  activityDocks,
  loginCookie,
  passwordHash,
  resetDatabase,
  seedBase,
} from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let truckTypeId: number
let dockId: number
let customerCookie: string
let customer2Cookie: string
let mateCookie: string
let adminCookie: string
let checkerCookie: string
let gateCookie: string

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, {
    docks: activityDocks(2, 'UNLOADING'),
    truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
  })
  truckTypeId = seeded.truckTypes[0]!.id
  dockId = seeded.docks[0]!.id

  adminCookie = await loginCookie(app, 'admin@test.local')
  checkerCookie = await loginCookie(app, 'checker@test.local')
  gateCookie = await loginCookie(app, 'gate@test.local')
  customerCookie = await loginCookie(app, 'customer1@test.local')
  customer2Cookie = await loginCookie(app, 'customer2@test.local')

  // Rekan seperusahaan: akun kedua di PT Alpha, bukti laporan dibagi per
  // perusahaan, bukan per akun.
  await prisma.user.create({
    data: {
      name: 'Rekan Alpha',
      email: 'rekan.alpha@test.local',
      role: 'CUSTOMER',
      customerId: seeded.customerA.id,
      passwordHash: await passwordHash(),
    },
  })
  mateCookie = await loginCookie(app, 'rekan.alpha@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

function payload(overrides: Record<string, unknown> = {}) {
  return {
    bookingDate: TOMORROW(),
    activityType: 'UNLOADING',
    truckTypeId,
    startMinute: 9 * 60,
    referenceDocNo: 'DO-REPORT-001',
    licensePlate: 'B 1234 XYZ',
    driverName: 'Supir Tes',
    ...overrides,
  }
}

async function createBooking(
  cookie: string,
  overrides: Record<string, unknown> = {}
) {
  const response = await request(app)
    .post('/api/bookings')
    .set('Cookie', cookie)
    .send(payload(overrides))
  expect(response.status).toBe(201)
  return response.body.data as { id: string; bookingCode: string }
}

/** Jam Jakarta pada tanggal booking; E pada akhir bulan tetap aman. */
function jakarta(day: string, minute: number): Date {
  const hour = String(Math.floor(minute / 60)).padStart(2, '0')
  const rest = String(minute % 60).padStart(2, '0')
  return new Date(`${day}T${hour}:${rest}:00.000+07:00`)
}

const DAY = TOMORROW()

async function finishBooking(
  id: string,
  options: {
    gateIn?: number
    started?: number
    completed?: number
    out?: number
    lateMinutes?: number
  } = {}
) {
  const gateIn = options.gateIn ?? 9 * 60 + 5
  const started = options.started ?? 9 * 60 + 15
  const completed = options.completed ?? 9 * 60 + 55
  const out = options.out ?? 10 * 60 + 5

  await prisma.booking.update({
    where: { id },
    data: {
      status: 'CHECKED_OUT',
      assignedDockId: dockId,
      lateMinutes: options.lateMinutes ?? 0,
    },
  })
  // Booking baru sudah punya baris timeLog kosong (dibuat bersama booking),
  // jadi baris diisi lewat upsert, bukan create.
  await prisma.bookingTimeLog.upsert({
    where: { bookingId: id },
    create: { bookingId: id },
    update: {
      gateInAt: jakarta(DAY, gateIn),
      processStartedAt: jakarta(DAY, started),
      processCompletedAt: jakarta(DAY, completed),
      gateOutAt: jakarta(DAY, out),
    },
  })
}

function myReport(cookie: string, query: Record<string, string> = {}) {
  return request(app)
    .get('/api/reports/my')
    .query({ from: DAY, to: DAY, ...query })
    .set('Cookie', cookie)
}

describe('laporan customer: kepemilikan data', () => {
  it('hanya memuat booking perusahaan sendiri', async () => {
    await createBooking(customerCookie, { referenceDocNo: 'DO-ALPHA' })
    await createBooking(customer2Cookie, {
      referenceDocNo: 'DO-BETA',
      startMinute: 10 * 60,
    })

    const response = await myReport(customerCookie)

    expect(response.status).toBe(200)
    expect(response.body.data.rows).toHaveLength(1)
    expect(response.body.data.rows[0].referenceDocNo).toBe('DO-ALPHA')
    expect(response.body.data.customer.name).toBe('PT Alpha Logistik')
  })

  it('mengabaikan customerId dari query string', async () => {
    const seeded = await prisma.customer.findUniqueOrThrow({
      where: { code: 'CUST-002' },
    })
    await createBooking(customerCookie, { referenceDocNo: 'DO-ALPHA' })
    await createBooking(customer2Cookie, {
      referenceDocNo: 'DO-BETA',
      startMinute: 10 * 60,
    })

    const response = await myReport(customerCookie, {
      customerId: seeded.id,
    })

    expect(response.status).toBe(200)
    expect(response.body.data.rows).toHaveLength(1)
    expect(response.body.data.rows[0].referenceDocNo).toBe('DO-ALPHA')
  })

  it('rekan seperusahaan melihat laporan yang sama', async () => {
    await createBooking(customerCookie)

    const mine = await myReport(customerCookie)
    const mate = await myReport(mateCookie)

    expect(mate.status).toBe(200)
    expect(mate.body.data.rows).toEqual(mine.body.data.rows)
  })

  it('menolak akun customer tanpa perusahaan', async () => {
    await prisma.user.create({
      data: {
        name: 'Tanpa Perusahaan',
        email: 'orphan@test.local',
        role: 'CUSTOMER',
        customerId: null,
        passwordHash: await passwordHash(),
      },
    })
    const orphanCookie = await loginCookie(app, 'orphan@test.local')

    const response = await myReport(orphanCookie)
    expect(response.status).toBe(403)
  })
})

describe('laporan customer: peran dan bentuk respons', () => {
  it('menolak staf di rute customer', async () => {
    for (const cookie of [adminCookie, checkerCookie, gateCookie]) {
      const response = await myReport(cookie)
      expect(response.status).toBe(403)
    }
  })

  it('menolak customer di rute staf', async () => {
    const kpi = await request(app)
      .get('/api/reports/kpi')
      .query({ from: DAY, to: DAY })
      .set('Cookie', customerCookie)
    const exported = await request(app)
      .get('/api/reports/export.xlsx')
      .query({ from: DAY, to: DAY })
      .set('Cookie', customerCookie)

    expect(kpi.status).toBe(403)
    expect(exported.status).toBe(403)
  })

  it('tidak membocorkan kapasitas maupun utilisasi gudang', async () => {
    const booking = await createBooking(customerCookie)
    await finishBooking(booking.id)

    const response = await myReport(customerCookie)
    const data = response.body.data

    expect(data).not.toHaveProperty('arrivalsByHour')
    expect(data).not.toHaveProperty('byDock')
    expect(data.kpi).not.toHaveProperty('utilization')
    expect(data.byHour).toHaveLength(
      (1020 - 480) / 60 // 09.00 sampai 16.00 dari seed
    )
    for (const hour of data.byHour) {
      expect(Object.keys(hour).sort()).toEqual(['arrivals', 'hour', 'label'])
    }
    expect(JSON.stringify(data)).not.toContain('capacity')
    expect(JSON.stringify(data)).not.toContain('utilization')
  })
})

describe('laporan customer: validasi rentang', () => {
  it('menolak tanggal awal setelah tanggal akhir', async () => {
    const response = await myReport(customerCookie, {
      from: addDaysISO(DAY, 1),
      to: DAY,
    })
    expect(response.status).toBe(400)
  })

  it('menerima 366 hari dan menolak 367 hari', async () => {
    const to = DAY
    const ok = await myReport(customerCookie, {
      from: addDaysISO(to, -365),
      to,
    })
    const tooLong = await myReport(customerCookie, {
      from: addDaysISO(to, -366),
      to,
    })

    expect(ok.status).toBe(200)
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error.details?.[0]?.message).toContain('366')
  })
})

describe('laporan customer: hitungan KPI', () => {
  it('menghitung tunggu, proses, turnaround, dan on-time', async () => {
    const done = await createBooking(customerCookie)
    await finishBooking(done.id)
    const noShow = await createBooking(customerCookie, {
      startMinute: 10 * 60,
      referenceDocNo: 'DO-NO-SHOW',
    })
    await prisma.booking.update({
      where: { id: noShow.id },
      data: { status: 'NO_SHOW' },
    })

    const { kpi } = (await myReport(customerCookie)).body.data

    expect(kpi.totalBookings).toBe(2)
    expect(kpi.completed).toBe(1)
    expect(kpi.noShow).toBe(1)
    expect(kpi.onTimeRate).toBe(100)
    expect(kpi.averageWaitingMinutes).toBe(10)
    expect(kpi.averageProcessingMinutes).toBe(40)
    expect(kpi.averageTurnaroundMinutes).toBe(60)
  })

  it('memakai blok yang dikunci saat booking, bukan durasi jenis truk sekarang', async () => {
    const booking = await createBooking(customerCookie)
    await finishBooking(booking.id)

    const before = (await myReport(customerCookie)).body.data
    expect(before.rows[0].blocksLocked).toBe(2)
    expect(before.rows[0].slotMinutes).toBe(60)
    expect(before.rows[0].slotUsedPercent).toBe(67)
    expect(before.rows[0].slotOverrunMinutes).toBe(0)

    await prisma.truckType.update({
      where: { id: truckTypeId },
      data: { durationMinutes: 180, blocksRequired: 6 },
    })

    const after = (await myReport(customerCookie)).body.data
    expect(after.rows[0].slotMinutes).toBe(60)
    expect(after.rows[0].slotUsedPercent).toBe(67)
  })

  it('menandai proses yang melewati blok', async () => {
    const booking = await createBooking(customerCookie)
    await finishBooking(booking.id, { completed: 10 * 60 + 25 })

    const data = (await myReport(customerCookie)).body.data

    expect(data.rows[0].slotUsedPercent).toBe(117)
    expect(data.rows[0].slotOverrunMinutes).toBe(10)
    expect(data.kpi.overrunCount).toBe(1)
  })
})

describe('ekspor Excel laporan customer', () => {
  function download(cookie: string) {
    return request(app)
      .get('/api/reports/my/export.xlsx')
      .query({ from: DAY, to: DAY })
      .set('Cookie', cookie)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
  }

  it('mengirim tiga sheet dan hanya baris perusahaan sendiri', async () => {
    const mine = await createBooking(customerCookie, {
      referenceDocNo: 'DO-ALPHA',
    })
    await finishBooking(mine.id)
    await createBooking(customer2Cookie, {
      referenceDocNo: 'DO-BETA',
      startMinute: 10 * 60,
    })

    const response = await download(customerCookie)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain(
      'spreadsheetml.sheet'
    )
    expect(response.headers['content-disposition']).toContain(
      'laporan-CUST-001'
    )

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(response.body as Buffer)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Ringkasan',
      'Detail',
      'per Hari',
    ])

    const detail = workbook.getWorksheet('Detail')!
    // Header + satu baris milik Alpha; baris Beta tidak ikut.
    expect(detail.actualRowCount).toBe(2)
    expect(detail.getCell('A2').value).toBe(mine.bookingCode)
    expect(detail.getCell('I2').value).toBe('Sudah keluar')
    // Jam ditulis sebagai YYYY-MM-DD HH:mm agar bisa diurutkan di Excel.
    expect(detail.getCell('K2').value).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    )
  })
})
