import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { addDaysISO, todayISO } from '../src/lib/time'
import {
  buildBookingCode,
  isBookingCode,
  nextFreeSequence,
  normalizeBookingCodePrefix,
} from '../src/modules/bookings/repository'
import { activityDocks, loginCookie, resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

const TOMORROW = () => addDaysISO(todayISO(), 1)

let customerCookie: string
let truckTypeId: number

beforeEach(async () => {
  await resetDatabase(prisma)
  const seeded = await seedBase(prisma, { docks: activityDocks(2, 'UNLOADING') })
  truckTypeId = seeded.truckTypes[0]!.id
  customerCookie = await loginCookie(app, 'customer1@test.local')
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function createBooking() {
  const response = await request(app)
    .post('/api/bookings')
    .set('Cookie', customerCookie)
    .send({
      bookingDate: TOMORROW(),
      activityType: 'UNLOADING',
      truckTypeId,
      startMinute: 9 * 60,
      referenceDocNo: 'DO-CODE-001',
      licensePlate: 'B 1234 XYZ',
      driverName: 'Supir Tes',
      driverPhone: '081234567890',
    })
  expect(response.status).toBe(201)
  return response.body.data as { id: string; bookingCode: string }
}

describe('awalan kode booking', () => {
  it('memaksa huruf besar dan menolak bentuk lain', () => {
    expect(normalizeBookingCodePrefix('tkt')).toBe('TKT')
    expect(normalizeBookingCodePrefix(' TSB ')).toBe('TSB')
    expect(normalizeBookingCodePrefix('A1')).toBe('TSB')
    expect(normalizeBookingCodePrefix('ABCD')).toBe('TSB')
    expect(normalizeBookingCodePrefix('TK-')).toBe('TSB')
    expect(normalizeBookingCodePrefix(null)).toBe('TSB')
    expect(normalizeBookingCodePrefix(undefined)).toBe('TSB')
  })

  it('menyusun kode dari awalan yang diberikan', () => {
    expect(buildBookingCode('2026-11-25', 7, 'TKT')).toBe('TKT-20261125-007')
    expect(buildBookingCode('2026-11-25', 7)).toBe('TSB-20261125-007')
  })

  it('mengenali kode dari awalan mana pun, bukan hanya TSB', () => {
    // Inilah yang membuat tiket lama tetap hidup setelah awalan diganti:
    // pengenalan bekerja dari bentuk, bukan dari huruf awalannya.
    expect(isBookingCode('TSB-20261125-001')).toBe(true)
    expect(isBookingCode('TKT-20261125-001')).toBe(true)
    expect(isBookingCode('A1B-20261125-999')).toBe(true)
    expect(isBookingCode('TKT-20261125-1')).toBe(true)
    expect(isBookingCode('TK-20261125-001')).toBe(false)
    expect(isBookingCode('TKT-2026-001')).toBe(false)
    expect(isBookingCode('bukan-kode')).toBe(false)
  })
})

describe('nomor urut tidak bentrok saat penghitung tertinggal', () => {
  it('memakai nomor awal bila belum ada kode di tanggal itu', async () => {
    const dateISO = TOMORROW()

    expect(await nextFreeSequence(prisma, dateISO, 5, 'TSB')).toBe(5)
    // Penghitung bisa saja 0 setelah reset; nomor urut selalu mulai dari 1.
    expect(await nextFreeSequence(prisma, dateISO, 0, 'TSB')).toBe(1)
  })

  it('melewati nomor yang sudah dipakai', async () => {
    const dateISO = TOMORROW()
    const prefix = `TSB-${dateISO.replace(/-/g, '')}-`

    const first = await createBooking()
    // Tiru data lama/impor yang sudah memakai nomor jauh di depan penghitung.
    await prisma.booking.update({
      where: { id: first.id },
      data: { bookingCode: `${prefix}005` },
    })

    expect(await nextFreeSequence(prisma, dateISO, 5, 'TSB')).toBe(6)
    expect(await nextFreeSequence(prisma, dateISO, 1, 'TSB')).toBe(1)
  })

  it('pembuatan booking tetap berhasil walau nomor penghitung sudah dipakai', async () => {
    const dateISO = TOMORROW()

    // Booking pertama memakai 001 dan menaikkan penghitung ke 1.
    const first = await createBooking()
    expect(first.bookingCode.endsWith('-001')).toBe(true)

    // Tiru penghitung yang tertinggal: kode 002 sudah ada, tetapi penghitung
    // masih di 1. Tanpa lompatan, booking berikutnya gagal 500 karena bentrok.
    await prisma.booking.update({
      where: { id: first.id },
      data: { bookingCode: buildBookingCode(dateISO, 2) },
    })

    const next = await createBooking()
    expect(next.bookingCode.endsWith('-003')).toBe(true)
  })
})
