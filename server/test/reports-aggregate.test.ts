import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { dateOnlyToUtc } from '../src/lib/time'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

/**
 * Laporan staf dan laporan customer menghitung angka yang sama dari baris yang
 * sama. Berkas ini mengunci dua hal sekaligus:
 *
 * 1. Laporan staf yang disaring ke satu customer harus menghasilkan KPI dan
 *    rekap harian yang identik dengan laporan customer itu sendiri — kalau dua
 *    salinan agregasi menyimpang, tes ini yang pertama gagal.
 * 2. Dock yang melayani bongkar dan muat dilaporkan sebagai BOTH, bukan
 *    aktivitas truk yang kebetulan datang lebih dulu.
 */
const DAY = '2026-11-13'

let seed: Awaited<ReturnType<typeof seedBase>>

beforeEach(async () => {
  await resetDatabase(prisma)
  seed = await seedBase(prisma, {
    docks: [
      { dockCode: 'D1', allowedActivity: 'BOTH' },
      { dockCode: 'D2', allowedActivity: 'UNLOADING' },
    ],
    operatingStartMinute: 480,
    operatingEndMinute: 1020,
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Waktu Jakarta pada hari laporan; offset ditulis eksplisit agar tidak bergantung TZ mesin. */
function jakarta(time: string): Date {
  return new Date(`${DAY}T${time}:00+07:00`)
}

let sequence = 0

async function seedBooking(options: {
  customerId: string
  activityType: 'LOADING' | 'UNLOADING'
  status: 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'BOOKED_READY'
  dockId?: number
  lateMinutes?: number
  log?: {
    gateIn: string
    processStart: string
    processDone: string
    gateOut: string
  }
}) {
  sequence += 1
  const start = jakarta('09:00')
  return prisma.booking.create({
    data: {
      bookingCode: `TSB-20261113-${String(sequence).padStart(3, '0')}`,
      referenceDocNo: `REF-${sequence}`,
      qrToken: `token-${String(sequence).padStart(26, '0')}`,
      customerId: options.customerId,
      createdById: seed.customer.id,
      activityType: options.activityType,
      truckTypeId: seed.truckTypes[0]!.id,
      bookingDate: dateOnlyToUtc(DAY),
      startTime: start,
      endTime: new Date(start.getTime() + 60 * 60 * 1000),
      blocksLocked: 2,
      status: options.status,
      lateMinutes: options.lateMinutes ?? 0,
      assignedDockId: options.dockId ?? null,
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
      ...(options.log
        ? {
            timeLog: {
              create: {
                gateInAt: jakarta(options.log.gateIn),
                processStartedAt: jakarta(options.log.processStart),
                processCompletedAt: jakarta(options.log.processDone),
                gateOutAt: jakarta(options.log.gateOut),
              },
            },
          }
        : {}),
    },
  })
}

async function seedReportData() {
  const [bothDock, unloadingDock] = seed.docks

  await seedBooking({
    customerId: seed.customerA.id,
    activityType: 'UNLOADING',
    status: 'CHECKED_OUT',
    dockId: bothDock!.id,
    log: { gateIn: '09:00', processStart: '09:10', processDone: '09:40', gateOut: '09:55' },
  })
  await seedBooking({
    customerId: seed.customerA.id,
    activityType: 'LOADING',
    status: 'CHECKED_OUT',
    dockId: bothDock!.id,
    lateMinutes: 5,
    log: { gateIn: '10:05', processStart: '10:20', processDone: '11:00', gateOut: '11:10' },
  })
  await seedBooking({
    customerId: seed.customerA.id,
    activityType: 'UNLOADING',
    status: 'CANCELLED',
  })
  await seedBooking({
    customerId: seed.customerA.id,
    activityType: 'UNLOADING',
    status: 'NO_SHOW',
  })
  await seedBooking({
    customerId: seed.customerA.id,
    activityType: 'UNLOADING',
    status: 'BOOKED_READY',
    dockId: unloadingDock!.id,
  })
  // Perusahaan lain: harus hilang dari laporan customer A.
  await seedBooking({
    customerId: seed.customerB.id,
    activityType: 'LOADING',
    status: 'CHECKED_OUT',
    dockId: bothDock!.id,
    log: { gateIn: '13:00', processStart: '13:10', processDone: '13:40', gateOut: '13:55' },
  })
}

async function staffReport(query: string) {
  const cookie = await loginCookie(app, 'admin@test.local')
  const response = await request(app)
    .get(`/api/reports/kpi?from=${DAY}&to=${DAY}${query}`)
    .set('Cookie', cookie)
  expect(response.status).toBe(200)
  return response.body.data
}

async function customerReport() {
  const cookie = await loginCookie(app, 'customer1@test.local')
  const response = await request(app)
    .get(`/api/reports/my?from=${DAY}&to=${DAY}`)
    .set('Cookie', cookie)
  expect(response.status).toBe(200)
  return response.body.data
}

describe('agregasi laporan', () => {
  it('laporan staf tersaring sama dengan laporan customer pemiliknya', async () => {
    await seedReportData()

    const scoped = await staffReport(`&customerId=${seed.customerA.id}`)
    const mine = await customerReport()

    const sharedKpi = {
      totalBookings: mine.kpi.totalBookings,
      completed: mine.kpi.completed,
      cancelled: mine.kpi.cancelled,
      noShow: mine.kpi.noShow,
      expiredPending: mine.kpi.expiredPending,
      onTimeRate: mine.kpi.onTimeRate,
      averageWaitingMinutes: mine.kpi.averageWaitingMinutes,
      averageProcessingMinutes: mine.kpi.averageProcessingMinutes,
      averageTurnaroundMinutes: mine.kpi.averageTurnaroundMinutes,
      averageLateMinutes: mine.kpi.averageLateMinutes,
    }

    expect(scoped.kpi).toMatchObject(sharedKpi)

    expect(
      scoped.byDay.map((day: Record<string, unknown>) => ({
        date: day.date,
        total: day.total,
        completed: day.completed,
        late: day.late,
        averageWaitingMinutes: day.averageWaitingMinutes,
        averageTurnaroundMinutes: day.averageTurnaroundMinutes,
      }))
    ).toEqual(
      mine.byDay.map((day: Record<string, unknown>) => ({
        date: day.date,
        total: day.total,
        completed: day.completed,
        late: day.late,
        averageWaitingMinutes: day.averageWaitingMinutes,
        averageTurnaroundMinutes: day.averageTurnaroundMinutes,
      }))
    )

    expect(scoped.byActivity).toEqual(mine.byActivity)

    // Grafik kedatangan customer memakai jam yang sama dengan laporan staf.
    expect(mine.byHour.map((hour: { arrivals: number }) => hour.arrivals)).toEqual(
      scoped.arrivalsByHour.map((hour: { arrivals: number }) => hour.arrivals)
    )

    expect(scoped.kpi.totalBookings).toBe(5)
  })

  it('menghitung KPI laporan staf dari data yang sudah disemai', async () => {
    await seedReportData()

    const report = await staffReport(`&customerId=${seed.customerA.id}`)

    expect(report.kpi).toMatchObject({
      totalBookings: 5,
      completed: 2,
      cancelled: 1,
      noShow: 1,
      expiredPending: 0,
      // Dua truk masuk; satu terlambat 5 menit.
      onTimeRate: 50,
      averageWaitingMinutes: 13,
      averageProcessingMinutes: 35,
      averageTurnaroundMinutes: 60,
      averageLateMinutes: 5,
    })
    expect(report.byActivity).toEqual([
      { activity: 'LOADING', total: 1 },
      { activity: 'UNLOADING', total: 4 },
    ])
  })

  it('melaporkan dock yang melayani dua aktivitas sebagai BOTH', async () => {
    await seedReportData()

    const report = await staffReport('')

    const docks = new Map<string, { activity: string; trucks: number }>(
      report.byDock.map((dock: { dockCode: string; activity: string; trucks: number }) => [
        dock.dockCode,
        { activity: dock.activity, trucks: dock.trucks },
      ])
    )

    expect(docks.get('D1')).toEqual({ activity: 'BOTH', trucks: 3 })
    expect(docks.get('D2')).toEqual({ activity: 'UNLOADING', trucks: 1 })
  })
})
