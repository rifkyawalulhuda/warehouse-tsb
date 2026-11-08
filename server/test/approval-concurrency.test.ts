import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { addDaysISO, dateOnlyToUtc, jakartaInstant, todayISO } from '../src/lib/time'
import { getSettings, toWindow } from '../src/lib/settings'
import { finalizeRelease } from '../src/modules/bookings/quota-service'
import { resetDatabase, seedBase } from './helpers'

const prisma = new PrismaClient()
/** Koneksi kedua: race hanya terbukti dengan dua transaksi sungguhan. */
const prisma2 = new PrismaClient()

const TOMORROW = () => addDaysISO(todayISO(), 1)

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
  await prisma2.$disconnect()
})

async function seedPendingBooking(prismaClient: PrismaClient, suffix: string) {
  const seeded = await seedBase(prismaClient, {
    docks: [{ dockCode: 'D1', allowedActivity: 'UNLOADING' }],
    truckTypes: [{ truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 }],
  })
  const date = TOMORROW()
  const customer = seeded.customer

  return prismaClient.booking.create({
    data: {
      bookingCode: `TSB-RACE-${suffix}`,
      qrToken: `qr-race-${suffix}`.padEnd(32, '0'),
      referenceDocNo: 'DO-RACE',
      customerId: seeded.customerA.id,
      createdById: customer.id,
      activityType: 'UNLOADING',
      truckTypeId: seeded.truckTypes[0]!.id,
      bookingDate: dateOnlyToUtc(date),
      startTime: jakartaInstant(date, 9 * 60),
      endTime: jakartaInstant(date, 10 * 60),
      blocksLocked: 2,
      status: 'BOOKED_READY',
      approvalStatus: 'PENDING',
      approvalDeadline: new Date(Date.now() - 60_000),
      licensePlate: 'B 5555 RR',
      driverName: 'Supir Race',
    },
  })
}

/** Meniru klaim approval: hanya satu transaksi yang boleh menang. */
async function approve(client: PrismaClient, bookingId: string) {
  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE bookings
      SET approval_status = 'APPROVED', approved_at = now()
      WHERE id = ${bookingId}::uuid AND approval_status = 'PENDING'
      RETURNING id
    `
    return rows.length > 0
  })
}

/** Meniru jalur expire: klaim status lalu lepas kuota lewat satu pintu. */
async function expire(client: PrismaClient, bookingId: string, date: string) {
  const settings = await getSettings()
  const window = toWindow(settings)

  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE bookings
      SET status = 'CANCELLED', approval_status = 'EXPIRED'
      WHERE id = ${bookingId}::uuid AND approval_status = 'PENDING'
      RETURNING id
    `
    if (rows.length === 0) return false

    await finalizeRelease(tx, {
      bookingId,
      date,
      activity: 'UNLOADING',
      startMinute: 9 * 60,
      blocksRequired: 2,
      window,
    })
    return true
  })
}

describe('race approve vs expire', () => {
  it('tepat satu pemenang dan kuota dilepas hanya bila expire menang', async () => {
    const booking = await seedPendingBooking(prisma, 'A')

    // Sengaja tanpa menunggu: dua transaksi menyentuh baris yang sama.
    const [approved, expired] = await Promise.all([
      approve(prisma, booking.id),
      expire(prisma2, booking.id, TOMORROW()),
    ])

    // Persis satu yang menang.
    expect([approved, expired].filter(Boolean)).toHaveLength(1)

    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    expect(after).not.toBeNull()

    if (approved) {
      expect(after!.approvalStatus).toBe('APPROVED')
      expect(after!.status).toBe('BOOKED_READY')
      // Disetujui: kuota TIDAK dilepas, slot tetap tergenggam.
      expect(after!.quotaReleasedAt).toBeNull()
    } else {
      expect(after!.approvalStatus).toBe('EXPIRED')
      expect(after!.status).toBe('CANCELLED')
      expect(after!.quotaReleasedAt).not.toBeNull()
    }
  })

  it('booking tidak pernah berakhir APPROVED sekaligus EXPIRED', async () => {
    const booking = await seedPendingBooking(prisma, 'B')

    await Promise.all([
      approve(prisma, booking.id),
      expire(prisma2, booking.id, TOMORROW()),
    ])

    const after = await prisma.booking.findUnique({ where: { id: booking.id } })
    const statuses = new Set([after!.approvalStatus])
    expect(statuses.size).toBe(1)
    expect(['APPROVED', 'EXPIRED']).toContain(after!.approvalStatus)
    // Status booking harus konsisten dengan pemenangnya.
    if (after!.approvalStatus === 'APPROVED') {
      expect(after!.status).toBe('BOOKED_READY')
    } else {
      expect(after!.status).toBe('CANCELLED')
    }
  })

  it('dua approve paralel: hanya satu yang menang', async () => {
    const booking = await seedPendingBooking(prisma, 'C')

    const [first, second] = await Promise.all([
      approve(prisma, booking.id),
      approve(prisma2, booking.id),
    ])

    expect([first, second].filter(Boolean)).toHaveLength(1)
  })
})
