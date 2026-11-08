import { Router } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { diffMinutes, minuteOfDayJakarta, utcToDateOnly } from '../../lib/time'
import { getSettings } from '../../lib/settings'

export const reportsRouter = Router()

reportsRouter.use(requireAuth, requireExactRole('ADMIN', 'CHECKER'))

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

type ReportRow = {
  bookingCode: string
  bookingDate: string
  activityType: string
  customer: string
  truckType: string
  dockCode: string | null
  status: string
  approvalStatus: string
  scheduledStart: string
  gateInAt: string | null
  processStartedAt: string | null
  processCompletedAt: string | null
  gateOutAt: string | null
  waitingMinutes: number | null
  processingMinutes: number | null
  turnaroundMinutes: number | null
  lateMinutes: number
}

function formatInstant(value: Date | null): string | null {
  if (!value) return null
  return value.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
}

async function buildReport(from: string, to: string) {
  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
    select: {
      bookingCode: true,
      bookingDate: true,
      activityType: true,
      status: true,
      approvalStatus: true,
      startTime: true,
      lateMinutes: true,
      customer: { select: { name: true, companyName: true } },
      truckType: { select: { truckName: true } },
      assignedDock: { select: { dockCode: true } },
      timeLog: true,
    },
    orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
  })

  const rows: ReportRow[] = bookings.map((booking) => {
    const log = booking.timeLog
    return {
      bookingCode: booking.bookingCode,
      bookingDate: utcToDateOnly(booking.bookingDate),
      activityType: booking.activityType,
      customer: booking.customer.companyName ?? booking.customer.name,
      truckType: booking.truckType.truckName,
      dockCode: booking.assignedDock?.dockCode ?? null,
      status: booking.status,
      approvalStatus: booking.approvalStatus,
      scheduledStart: formatInstant(booking.startTime) ?? '',
      gateInAt: formatInstant(log?.gateInAt ?? null),
      processStartedAt: formatInstant(log?.processStartedAt ?? null),
      processCompletedAt: formatInstant(log?.processCompletedAt ?? null),
      gateOutAt: formatInstant(log?.gateOutAt ?? null),
      waitingMinutes: diffMinutes(log?.gateInAt, log?.processStartedAt),
      processingMinutes: diffMinutes(log?.processStartedAt, log?.processCompletedAt),
      turnaroundMinutes: diffMinutes(log?.gateInAt, log?.gateOutAt),
      lateMinutes: booking.lateMinutes,
    }
  })

  const finished = rows.filter((row) => row.turnaroundMinutes !== null)
  const average = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

  const kpi = {
    totalBookings: rows.length,
    completed: rows.filter((row) => row.status === 'CHECKED_OUT').length,
    cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
    noShow: rows.filter((row) => row.status === 'NO_SHOW').length,
    // Booking ini berakhir CANCELLED, tetapi penyebabnya bukan customer:
    // Admin tidak memutuskan sampai tenggat. Dihitung dari sumbu approval
    // supaya tidak tercampur dengan pembatalan biasa.
    expiredPending: rows.filter((row) => row.approvalStatus === 'EXPIRED').length,
    onTimeRate:
      rows.length === 0
        ? 0
        : Math.round(
            (rows.filter((row) => row.lateMinutes === 0 && row.gateInAt).length /
              Math.max(1, rows.filter((row) => row.gateInAt).length)) *
              100
          ),
    averageWaitingMinutes: average(
      rows.map((row) => row.waitingMinutes).filter((v): v is number => v !== null)
    ),
    averageProcessingMinutes: average(
      rows.map((row) => row.processingMinutes).filter((v): v is number => v !== null)
    ),
    averageTurnaroundMinutes: average(
      finished.map((row) => row.turnaroundMinutes as number)
    ),
    averageLateMinutes: average(
      rows.filter((row) => row.lateMinutes > 0).map((row) => row.lateMinutes)
    ),
  }

  // Rekap per hari. Rata-rata dihitung dari baris yang memang punya durasi,
  // supaya hari yang belum selesai tidak menyeret angka ke nol.
  type DayEntry = {
    date: string
    total: number
    completed: number
    late: number
    turnaroundSum: number
    turnaroundCount: number
    waitingSum: number
    waitingCount: number
  }

  const byDayMap = new Map<string, DayEntry>()
  for (const row of rows) {
    const entry = byDayMap.get(row.bookingDate) ?? {
      date: row.bookingDate,
      total: 0,
      completed: 0,
      late: 0,
      turnaroundSum: 0,
      turnaroundCount: 0,
      waitingSum: 0,
      waitingCount: 0,
    }
    entry.total += 1
    if (row.status === 'CHECKED_OUT') entry.completed += 1
    if (row.lateMinutes > 0) entry.late += 1
    if (row.turnaroundMinutes !== null) {
      entry.turnaroundSum += row.turnaroundMinutes
      entry.turnaroundCount += 1
    }
    if (row.waitingMinutes !== null) {
      entry.waitingSum += row.waitingMinutes
      entry.waitingCount += 1
    }
    byDayMap.set(row.bookingDate, entry)
  }

  // Kedatangan per jam: jumlah gate-in yang jatuh pada tiap jam operasional,
  // dibandingkan kapasitas slot per jam (jumlah dock aktif x blok per jam).
  const settings = await getSettings()
  const activeDockCount = await prisma.dock.count({
    where: { currentStatus: { not: 'MAINTENANCE' } },
  })
  const blocksPerHour = Math.max(1, Math.floor(60 / settings.slotUnitMinutes))
  const hourlyCapacity = activeDockCount * blocksPerHour

  const arrivalsByHourMap = new Map<number, number>()
  for (const booking of bookings) {
    const gateInAt = booking.timeLog?.gateInAt
    if (!gateInAt) continue
    const hour = Math.floor(minuteOfDayJakarta(gateInAt) / 60)
    arrivalsByHourMap.set(hour, (arrivalsByHourMap.get(hour) ?? 0) + 1)
  }

  const firstHour = Math.floor(settings.operatingStartMinute / 60)
  const lastHour = Math.ceil(settings.operatingEndMinute / 60)
  const arrivalsByHour = Array.from({ length: Math.max(0, lastHour - firstHour) }, (_, index) => {
    const hour = firstHour + index
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}.00`,
      arrivals: arrivalsByHourMap.get(hour) ?? 0,
      capacity: hourlyCapacity,
    }
  })

  const byDay = [...byDayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      total: entry.total,
      completed: entry.completed,
      late: entry.late,
      averageTurnaroundMinutes:
        entry.turnaroundCount === 0
          ? 0
          : Math.round(entry.turnaroundSum / entry.turnaroundCount),
      averageWaitingMinutes:
        entry.waitingCount === 0 ? 0 : Math.round(entry.waitingSum / entry.waitingCount),
    }))

  const byActivity = [
    { activity: 'LOADING' as const, total: rows.filter((r) => r.activityType === 'LOADING').length },
    { activity: 'UNLOADING' as const, total: rows.filter((r) => r.activityType === 'UNLOADING').length },
  ]

  // Rekap per dock. Jam pakai dihitung dari waktu proses yang benar-benar
  // tercatat, lalu dibagi jam operasional x jumlah hari dalam rentang.
  const operatingHours = (settings.operatingEndMinute - settings.operatingStartMinute) / 60
  const dayCount = new Set(rows.map((row) => row.bookingDate)).size || 1

  type DockEntry = {
    dockCode: string
    activity: string
    trucks: number
    usedMinutes: number
    processingSum: number
    processingCount: number
  }

  const byDockMap = new Map<string, DockEntry>()
  for (const row of rows) {
    if (!row.dockCode) continue
    const entry = byDockMap.get(row.dockCode) ?? {
      dockCode: row.dockCode,
      activity: row.activityType,
      trucks: 0,
      usedMinutes: 0,
      processingSum: 0,
      processingCount: 0,
    }
    entry.trucks += 1
    if (row.processingMinutes !== null) {
      entry.processingSum += row.processingMinutes
      entry.processingCount += 1
      entry.usedMinutes += row.processingMinutes
    }
    byDockMap.set(row.dockCode, entry)
  }

  const byDock = [...byDockMap.values()]
    .sort((a, b) => a.dockCode.localeCompare(b.dockCode))
    .map((entry) => {
      const availableMinutes = operatingHours * 60 * dayCount
      return {
        dockCode: entry.dockCode,
        activity: entry.activity,
        trucks: entry.trucks,
        usedHours: Math.round((entry.usedMinutes / 60) * 10) / 10,
        averageProcessingMinutes:
          entry.processingCount === 0
            ? 0
            : Math.round(entry.processingSum / entry.processingCount),
        utilization:
          availableMinutes === 0
            ? 0
            : Math.min(100, Math.round((entry.usedMinutes / availableMinutes) * 100)),
      }
    })

  return {
    from,
    to,
    rows,
    kpi,
    byDay,
    byActivity,
    byDock,
    arrivalsByHour,
  }
}

reportsRouter.get('/kpi', async (req, res, next) => {
  try {
    const query = parse(rangeSchema, req.query, 'Rentang tanggal')
    const report = await buildReport(query.from, query.to)
    res.json({ data: report })
  } catch (error) {
    next(error)
  }
})

reportsRouter.get('/export.xlsx', async (req, res, next) => {
  try {
    const query = parse(rangeSchema, req.query, 'Rentang tanggal')
    const { rows, kpi } = await buildReport(query.from, query.to)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Warehouse TSB'
    workbook.created = new Date()

    const summary = workbook.addWorksheet('Ringkasan')
    summary.columns = [
      { header: 'Metrik', key: 'metric', width: 32 },
      { header: 'Nilai', key: 'value', width: 18 },
    ]
    summary.addRows([
      { metric: 'Periode', value: `${query.from} s/d ${query.to}` },
      { metric: 'Total booking', value: kpi.totalBookings },
      { metric: 'Selesai (gate-out)', value: kpi.completed },
      { metric: 'Dibatalkan', value: kpi.cancelled },
      { metric: 'No-show', value: kpi.noShow },
      { metric: 'Kedaluwarsa (tidak disetujui)', value: kpi.expiredPending },
      { metric: 'Tingkat on-time (%)', value: kpi.onTimeRate },
      { metric: 'Rata-rata waktu tunggu (menit)', value: kpi.averageWaitingMinutes },
      { metric: 'Rata-rata waktu proses (menit)', value: kpi.averageProcessingMinutes },
      { metric: 'Rata-rata turnaround (menit)', value: kpi.averageTurnaroundMinutes },
      { metric: 'Rata-rata keterlambatan (menit)', value: kpi.averageLateMinutes },
    ])
    summary.getRow(1).font = { bold: true }

    const sheet = workbook.addWorksheet('Detail Booking')
    sheet.columns = [
      { header: 'Kode', key: 'bookingCode', width: 22 },
      { header: 'Tanggal', key: 'bookingDate', width: 12 },
      { header: 'Aktivitas', key: 'activityType', width: 12 },
      { header: 'Customer', key: 'customer', width: 26 },
      { header: 'Jenis Truk', key: 'truckType', width: 18 },
      { header: 'Dock', key: 'dockCode', width: 10 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Jadwal', key: 'scheduledStart', width: 20 },
      { header: 'Gate In', key: 'gateInAt', width: 20 },
      { header: 'Mulai Proses', key: 'processStartedAt', width: 20 },
      { header: 'Selesai Proses', key: 'processCompletedAt', width: 20 },
      { header: 'Gate Out', key: 'gateOutAt', width: 20 },
      { header: 'Tunggu (mnt)', key: 'waitingMinutes', width: 13 },
      { header: 'Proses (mnt)', key: 'processingMinutes', width: 13 },
      { header: 'Turnaround (mnt)', key: 'turnaroundMinutes', width: 16 },
      { header: 'Terlambat (mnt)', key: 'lateMinutes', width: 15 },
    ]
    sheet.addRows(rows)
    sheet.getRow(1).font = { bold: true }
    sheet.autoFilter = { from: 'A1', to: 'P1' }

    const fileName = `laporan-tsb-${query.from}-${query.to}.xlsx`
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    next(error)
  }
})
