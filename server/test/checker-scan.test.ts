import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc, jakartaInstant, todayISO, utcToDateOnly } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

async function seedBooking(options: {
  customerId: string
  truckTypeId: number
  startTime: Date
  status?:
    | 'BOOKED_INCOMPLETE'
    | 'BOOKED_READY'
    | 'CHECKED_IN_ON_TIME'
    | 'LATE_WAITING_LIST'
    | 'DOCK_ASSIGNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
  approvalStatus?: 'PENDING' | 'APPROVED'
  activityType?: 'LOADING' | 'UNLOADING'
  dockId?: number
  gateInAt?: Date | null
}) {
  const companyId = (
    await prisma.user.findUniqueOrThrow({
      where: { id: options.customerId },
      select: { customerId: true },
    })
  ).customerId

  const booking = await prisma.booking.create({
    data: {
      bookingCode: `T-${Math.random().toString(36).slice(2, 8)}`,
      referenceDocNo: 'REF-TEST',
      qrToken: Math.random().toString(36).slice(2).padEnd(32, '0'),
      customerId: companyId!,
      createdById: options.customerId,
      activityType: options.activityType ?? 'UNLOADING',
      truckTypeId: options.truckTypeId,
      bookingDate: dateOnlyToUtc(utcToDateOnly(options.startTime)),
      startTime: options.startTime,
      endTime: new Date(options.startTime.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: options.status ?? 'BOOKED_READY',
      approvalStatus: options.approvalStatus ?? 'APPROVED',
      approvedAt: options.approvalStatus === 'PENDING' ? null : new Date(),
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
      assignedDockId: options.dockId ?? null,
    },
  })

  if (options.gateInAt !== null) {
    await prisma.bookingTimeLog.create({
      data: {
        bookingId: booking.id,
        gateInAt: options.gateInAt ?? options.startTime,
      },
    })
  }

  return booking
}

describe('pindai checker', () => {
  it('menawarkan penugasan dock hanya untuk dock kosong yang cocok', async () => {
    await resetDatabase(prisma)
    const { docks, customer, truckTypes } = await seedBase(prisma, {
      docks: [
        { dockCode: 'D1', allowedActivity: 'UNLOADING' },
        { dockCode: 'D2', allowedActivity: 'LOADING' },
        { dockCode: 'D3', allowedActivity: 'BOTH' },
      ],
    })
    const cookie = await loginCookie(app, 'checker@test.local')

    await prisma.dock.update({
      where: { id: docks[0]!.id },
      data: { currentStatus: 'OCCUPIED' },
    })

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(todayISO(), 9 * 60),
      status: 'CHECKED_IN_ON_TIME',
    })

    const response = await request(app)
      .get(`/api/ops/checker/scan/${booking.qrToken}`)
      .set('Cookie', cookie)

    expect(response.status).toBe(200)
    const data = response.body.data
    expect(data.actions).toEqual({ assignDock: true, start: false, finish: false })

    const eligible = data.docks.filter((dock: { eligible: boolean }) => dock.eligible)
    expect(eligible.map((dock: { dockCode: string }) => dock.dockCode)).toEqual(['D3'])

    const terpakai = data.docks.find((dock: { dockCode: string }) => dock.dockCode === 'D1')
    expect(terpakai.eligible).toBe(false)
  })

  it('menghitung urutan tunggu menurut siapa yang lebih dulu masuk gate', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'checker@test.local')
    const date = todayISO()

    const lebihDulu = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(date, 9 * 60),
      status: 'CHECKED_IN_ON_TIME',
      gateInAt: jakartaInstant(date, 8 * 60 + 45),
    })
    const belakangan = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[1]!.id,
      startTime: jakartaInstant(date, 10 * 60),
      status: 'LATE_WAITING_LIST',
      gateInAt: jakartaInstant(date, 9 * 60 + 15),
    })

    const pertama = await request(app)
      .get(`/api/ops/checker/scan/${lebihDulu.qrToken}`)
      .set('Cookie', cookie)
    const kedua = await request(app)
      .get(`/api/ops/checker/scan/${belakangan.qrToken}`)
      .set('Cookie', cookie)

    expect(pertama.body.data.waitingPosition).toBe(1)
    expect(kedua.body.data.waitingPosition).toBe(2)
    expect(kedua.body.data.waitingSince).toBe(
      jakartaInstant(date, 9 * 60 + 15).toISOString()
    )
  })

  it('memberi satu aksi saja sesuai status truk', async () => {
    await resetDatabase(prisma)
    const { docks, customer, truckTypes } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'checker@test.local')
    const startTime = jakartaInstant(todayISO(), 9 * 60)

    const diDock = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime,
      status: 'DOCK_ASSIGNED',
      dockId: docks[0]!.id,
    })
    const diproses = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime,
      status: 'IN_PROGRESS',
      dockId: docks[0]!.id,
    })

    const satu = await request(app)
      .get(`/api/ops/checker/scan/${diDock.qrToken}`)
      .set('Cookie', cookie)
    const dua = await request(app)
      .get(`/api/ops/checker/scan/${diproses.qrToken}`)
      .set('Cookie', cookie)

    expect(satu.body.data.actions).toEqual({
      assignDock: false,
      start: true,
      finish: false,
    })
    expect(dua.body.data.actions).toEqual({
      assignDock: false,
      start: false,
      finish: true,
    })
  })

  it('tidak memberi aksi untuk truk yang belum check-in di gate', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'checker@test.local')

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(todayISO(), 9 * 60),
      status: 'BOOKED_READY',
      gateInAt: null,
    })

    const response = await request(app)
      .get(`/api/ops/checker/scan/${booking.qrToken}`)
      .set('Cookie', cookie)

    expect(response.body.data.actions).toEqual({
      assignDock: false,
      start: false,
      finish: false,
    })
    expect(response.body.data.waitingPosition).toBeNull()
  })

  it('menahan penugasan dock selama booking belum disetujui Admin', async () => {
    await resetDatabase(prisma)
    const { customer, truckTypes } = await seedBase(prisma)
    const cookie = await loginCookie(app, 'checker@test.local')

    const booking = await seedBooking({
      customerId: customer.id,
      truckTypeId: truckTypes[0]!.id,
      startTime: jakartaInstant(todayISO(), 9 * 60),
      status: 'CHECKED_IN_ON_TIME',
      approvalStatus: 'PENDING',
    })

    const response = await request(app)
      .get(`/api/ops/checker/scan/${booking.qrToken}`)
      .set('Cookie', cookie)

    expect(response.body.data.actions.assignDock).toBe(false)
  })

  it('tidak mencatat pindai checker sebagai penolakan gate', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const cookie = await loginCookie(app, 'checker@test.local')

    await request(app).get('/api/ops/checker/scan/qr-tidak-ada').set('Cookie', cookie)
    expect(await prisma.scanAttempt.count()).toBe(0)
  })

  it('hanya terbuka untuk Checker', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)

    const checker = await loginCookie(app, 'checker@test.local')
    const gate = await loginCookie(app, 'gate@test.local')
    const customer = await loginCookie(app, 'customer1@test.local')

    const dibuka = await request(app)
      .get('/api/ops/checker/scan/qr-tidak-ada')
      .set('Cookie', checker)
    expect(dibuka.status).toBe(404)

    for (const cookie of [gate, customer]) {
      const ditolak = await request(app)
        .get('/api/ops/checker/scan/qr-tidak-ada')
        .set('Cookie', cookie)
      expect(ditolak.status).toBe(403)
    }
  })
})
