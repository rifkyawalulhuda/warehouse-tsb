import { Router } from 'express'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import dayjs from 'dayjs'
import { prisma } from '../../lib/prisma'
import { badRequest, forbidden } from '../../lib/http-error'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import {
  TZ,
  diffMinutes,
  isDateISO,
  utcToDateOnly,
} from '../../lib/time'
import { getSettings } from '../../lib/settings'
import {
  average,
  buildArrivalsByHour,
  buildByActivity,
  buildByDay,
  buildDockSummary,
  buildKpi,
  notNull,
} from './aggregate'
import {
  activityTypeLabel,
  approvalStatusLabel,
  bookingStatusLabel,
  REPORT_LABELS,
  reportFilePrefix,
  type ReportLang,
} from './labels'

export const reportsRouter = Router()

reportsRouter.use(requireAuth)

/**
 * Laporan staf dan laporan customer hidup di router yang sama, tetapi dijaga
 * oleh middleware yang berbeda per rute. Penjagaan di level router tidak bisa
 * dipakai lagi: satu `use` akan menutup salah satu dari keduanya.
 */
const staffOnly = requireExactRole('ADMIN', 'CHECKER')
const customerOnly = requireExactRole('CUSTOMER')

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /// Kosong = semua customer.
  customerId: z.uuid().optional(),
  /// Bahasa isi berkas Excel; bawaan Indonesia seperti sebelum ada pilihan.
  lang: z.enum(['id', 'en']).optional(),
})

/** Laporan customer hanya menerima tanggal; kepemilikan datang dari sesi. */
const customerRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: z.enum(['id', 'en']).optional(),
})

export const MAX_REPORT_RANGE_DAYS = 366

function rangeDayCount(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  return Math.round((end - start) / 86_400_000) + 1
}

/**
 * Rentang laporan dibatasi untuk kedua peran.
 *
 * Pola `\d{4}-\d{2}-\d{2}` di skema hanya memeriksa bentuk: `2026-13-45` lolos
 * dan berubah menjadi `Invalid Date` yang membuat Prisma melempar galat. Ekspor
 * juga membangun seluruh workbook di memori, jadi rentang tanpa batas adalah
 * cara termurah menghabiskan memori proses.
 */
function assertReportRange(from: string, to: string) {
  if (!isDateISO(from) || !isDateISO(to)) {
    throw badRequest('VALIDATION_ERROR', 'Rentang tanggal tidak valid', [
      { path: 'from', message: 'Tanggal tidak dikenal' },
    ])
  }
  if (from > to) {
    throw badRequest('VALIDATION_ERROR', 'Rentang tanggal tidak valid', [
      { path: 'to', message: 'Tanggal awal tidak boleh melewati tanggal akhir' },
    ])
  }
  if (rangeDayCount(from, to) > MAX_REPORT_RANGE_DAYS) {
    throw badRequest('VALIDATION_ERROR', 'Rentang tanggal tidak valid', [
      { path: 'to', message: `Rentang maksimal ${MAX_REPORT_RANGE_DAYS} hari` },
    ])
  }
}

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

/**
 * Waktu di laporan memakai bentuk yang bisa diurutkan apa adanya, bukan
 * `toLocaleString` yang menyelipkan detik dan pemisah yang bergantung pada data
 * ICU Node. Kolom waktu di Excel jadi bisa diurutkan sebagai teks.
 */
function formatReportInstant(value: Date | null): string | null {
  if (!value) return null
  return dayjs(value).tz(TZ).format('YYYY-MM-DD HH:mm')
}

async function buildReport(from: string, to: string, customerId?: string) {
  const bookings = await prisma.booking.findMany({
    where: {
      bookingDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
      ...(customerId ? { customerId } : {}),
    },
    select: {
      bookingCode: true,
      bookingDate: true,
      activityType: true,
      status: true,
      approvalStatus: true,
      startTime: true,
      lateMinutes: true,
      customer: { select: { name: true } },
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
      customer: booking.customer.name,
      truckType: booking.truckType.truckName,
      dockCode: booking.assignedDock?.dockCode ?? null,
      status: booking.status,
      approvalStatus: booking.approvalStatus,
      scheduledStart: formatReportInstant(booking.startTime) ?? '',
      gateInAt: formatReportInstant(log?.gateInAt ?? null),
      processStartedAt: formatReportInstant(log?.processStartedAt ?? null),
      processCompletedAt: formatReportInstant(log?.processCompletedAt ?? null),
      gateOutAt: formatReportInstant(log?.gateOutAt ?? null),
      waitingMinutes: diffMinutes(log?.gateInAt, log?.processStartedAt),
      processingMinutes: diffMinutes(log?.processStartedAt, log?.processCompletedAt),
      turnaroundMinutes: diffMinutes(log?.gateInAt, log?.gateOutAt),
      lateMinutes: booking.lateMinutes,
    }
  })

  const kpi = buildKpi(rows)

  // Rekap per hari. Rata-rata dihitung dari baris yang memang punya durasi,
  // supaya hari yang belum selesai tidak menyeret angka ke nol.
  const byDay = buildByDay(rows).map((day) => ({
    date: day.date,
    total: day.total,
    completed: day.completed,
    late: day.late,
    averageTurnaroundMinutes: day.averageTurnaroundMinutes,
    averageWaitingMinutes: day.averageWaitingMinutes,
  }))

  // Kedatangan per jam: jumlah gate-in yang jatuh pada tiap jam operasional,
  // dibandingkan kapasitas slot per jam (jumlah dock aktif x blok per jam).
  const settings = await getSettings()
  const activeDockCount = await prisma.dock.count({
    where: { currentStatus: { not: 'MAINTENANCE' } },
  })
  const blocksPerHour = Math.max(1, Math.floor(60 / settings.slotUnitMinutes))
  const hourlyCapacity = activeDockCount * blocksPerHour

  const arrivalsByHour = buildArrivalsByHour(
    bookings
      .map((booking) => booking.timeLog?.gateInAt ?? null)
      .filter((instant): instant is Date => instant !== null),
    settings
  ).map((hour) => ({ ...hour, capacity: hourlyCapacity }))

  const byActivity = buildByActivity(rows)

  // Rekap per dock. Jam pakai dihitung dari waktu proses yang benar-benar
  // tercatat, lalu dibagi jam operasional x jumlah hari dalam rentang.
  const operatingHours = (settings.operatingEndMinute - settings.operatingStartMinute) / 60
  const dayCount = new Set(rows.map((row) => row.bookingDate)).size || 1
  const byDock = buildDockSummary(rows, { operatingHours, dayCount })

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

reportsRouter.get('/kpi', staffOnly, async (req, res, next) => {
  try {
    const query = parse(rangeSchema, req.query, 'Rentang tanggal')
    assertReportRange(query.from, query.to)
    const report = await buildReport(query.from, query.to, query.customerId)
    res.json({ data: report })
  } catch (error) {
    next(error)
  }
})

reportsRouter.get('/export.xlsx', staffOnly, async (req, res, next) => {
  try {
    const query = parse(rangeSchema, req.query, 'Rentang tanggal')
    assertReportRange(query.from, query.to)
    const lang: ReportLang = query.lang ?? 'id'
    const labels = REPORT_LABELS[lang]
    const col = labels.columns
    const { rows, kpi } = await buildReport(query.from, query.to, query.customerId)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Warehouse TSB'
    workbook.created = new Date()

    const summary = workbook.addWorksheet(labels.sheets.customerSummary)
    summary.columns = [
      { header: col.metric, key: 'metric', width: 32 },
      { header: col.value, key: 'value', width: 18 },
    ]
    summary.addRows([
      {
        metric: labels.metrics.period,
        value: `${query.from} ${labels.rangeSeparator} ${query.to}`,
      },
      { metric: labels.metrics.totalBookings, value: kpi.totalBookings },
      { metric: labels.metrics.completed, value: kpi.completed },
      { metric: labels.metrics.cancelled, value: kpi.cancelled },
      { metric: labels.metrics.noShow, value: kpi.noShow },
      { metric: labels.metrics.expired, value: kpi.expiredPending },
      { metric: labels.metrics.onTimeRate, value: kpi.onTimeRate },
      { metric: labels.metrics.averageWaiting, value: kpi.averageWaitingMinutes },
      { metric: labels.metrics.averageProcessing, value: kpi.averageProcessingMinutes },
      { metric: labels.metrics.averageTurnaround, value: kpi.averageTurnaroundMinutes },
      { metric: labels.metrics.averageLate, value: kpi.averageLateMinutes },
    ])
    summary.getRow(1).font = { bold: true }

    const sheet = workbook.addWorksheet(labels.sheets.staffDetail)
    sheet.columns = [
      { header: col.bookingCode, key: 'bookingCode', width: 22 },
      { header: col.bookingDate, key: 'bookingDate', width: 12 },
      { header: col.activity, key: 'activityType', width: 12 },
      { header: col.customer, key: 'customer', width: 26 },
      { header: col.truckType, key: 'truckType', width: 18 },
      { header: col.dock, key: 'dockCode', width: 10 },
      { header: col.status, key: 'status', width: 20 },
      { header: col.scheduledStart, key: 'scheduledStart', width: 20 },
      { header: col.gateInAt, key: 'gateInAt', width: 20 },
      { header: col.processStartedAt, key: 'processStartedAt', width: 20 },
      { header: col.processCompletedAt, key: 'processCompletedAt', width: 20 },
      { header: col.gateOutAt, key: 'gateOutAt', width: 20 },
      { header: col.waiting, key: 'waitingMinutes', width: 13 },
      { header: col.processing, key: 'processingMinutes', width: 13 },
      { header: col.turnaround, key: 'turnaroundMinutes', width: 16 },
      { header: col.late, key: 'lateMinutes', width: 15 },
    ]
    sheet.addRows(
      rows.map((row) => ({
        ...row,
        activityType: activityTypeLabel(lang, row.activityType),
        status: bookingStatusLabel(lang, row.status),
        approvalStatus: approvalStatusLabel(lang, row.approvalStatus),
      }))
    )
    sheet.getRow(1).font = { bold: true }
    sheet.autoFilter = { from: 'A1', to: 'P1' }

    const fileName = `${reportFilePrefix(lang)}-tsb-${query.from}-${query.to}.xlsx`
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

/* --------------------------- laporan customer --------------------------- */

type CustomerReportRow = {
  bookingCode: string
  bookingDate: string
  activityType: string
  truckType: string
  licensePlate: string | null
  driverName: string | null
  referenceDocNo: string
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
  blocksLocked: number
  slotMinutes: number
  slotUsedPercent: number | null
  slotOverrunMinutes: number | null
}

/**
 * Label status, persetujuan, dan aktivitas untuk berkas yang dibaca di luar
 * aplikasi sudah pindah ke `labels.ts` (dua bahasa). Enum mentah
 * (CHECKED_OUT, NOT_REQUIRED) tidak berarti apa pun bagi customer.
 */

/**
 * Laporan milik satu perusahaan.
 *
 * Penyebut "pemakaian slot" adalah blok yang customer booking sendiri
 * (`blocksLocked` snapshot), bukan kapasitas gudang. Menyalin `capacity` dan
 * `utilization` dari laporan staf akan membocorkan jumlah dock sekaligus
 * menghasilkan persentase yang tidak bisa ditafsirkan customer.
 */
async function buildCustomerReport(from: string, to: string, customerId: string) {
  const [customer, bookings, settings] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { code: true, name: true },
    }),
    prisma.booking.findMany({
      where: {
        customerId,
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
        blocksLocked: true,
        licensePlate: true,
        driverName: true,
        referenceDocNo: true,
        truckType: { select: { truckName: true } },
        assignedDock: { select: { dockCode: true } },
        timeLog: true,
      },
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    }),
    getSettings(),
  ])

  if (!customer) throw forbidden('Akun tidak terhubung ke customer')

  const slotUnitMinutes = Math.max(1, settings.slotUnitMinutes)

  const rows: CustomerReportRow[] = bookings.map((booking) => {
    const log = booking.timeLog
    const processingMinutes = diffMinutes(
      log?.processStartedAt,
      log?.processCompletedAt
    )
    const slotMinutes = booking.blocksLocked * slotUnitMinutes

    return {
      bookingCode: booking.bookingCode,
      bookingDate: utcToDateOnly(booking.bookingDate),
      activityType: booking.activityType,
      truckType: booking.truckType.truckName,
      licensePlate: booking.licensePlate,
      driverName: booking.driverName,
      referenceDocNo: booking.referenceDocNo,
      dockCode: booking.assignedDock?.dockCode ?? null,
      status: booking.status,
      approvalStatus: booking.approvalStatus,
      scheduledStart: formatReportInstant(booking.startTime) ?? '',
      gateInAt: formatReportInstant(log?.gateInAt ?? null),
      processStartedAt: formatReportInstant(log?.processStartedAt ?? null),
      processCompletedAt: formatReportInstant(log?.processCompletedAt ?? null),
      gateOutAt: formatReportInstant(log?.gateOutAt ?? null),
      waitingMinutes: diffMinutes(log?.gateInAt, log?.processStartedAt),
      processingMinutes,
      turnaroundMinutes: diffMinutes(log?.gateInAt, log?.gateOutAt),
      lateMinutes: booking.lateMinutes,
      blocksLocked: booking.blocksLocked,
      slotMinutes,
      slotUsedPercent:
        processingMinutes === null || slotMinutes === 0
          ? null
          : Math.round((processingMinutes / slotMinutes) * 100),
      // Nol berarti pemakaian tepat di dalam blok; angka positif adalah
      // menit yang dipakai melewati blok yang customer kunci.
      slotOverrunMinutes:
        processingMinutes === null
          ? null
          : Math.max(0, processingMinutes - slotMinutes),
    }
  })

  const kpi = {
    ...buildKpi(rows),
    // Penyebut pemakaian slot adalah blok yang customer kunci sendiri
    // (`blocksLocked`), bukan kapasitas gudang.
    averageSlotUsedPercent: average(notNull(rows.map((row) => row.slotUsedPercent))),
    overrunCount: rows.filter((row) => (row.slotOverrunMinutes ?? 0) > 0).length,
  }

  const byDay = buildByDay(rows).map((day) => ({
    date: day.date,
    total: day.total,
    completed: day.completed,
    late: day.late,
    averageWaitingMinutes: day.averageWaitingMinutes,
    averageProcessingMinutes: day.averageProcessingMinutes,
    averageTurnaroundMinutes: day.averageTurnaroundMinutes,
    averageSlotUsedPercent: day.averageSlotUsedPercent,
  }))

  // Kedatangan per jam, tanpa pembanding kapasitas: garis kapasitas adalah
  // angka internal gudang dan sengaja tidak ikut ke laporan customer.
  const byHour = buildArrivalsByHour(
    bookings
      .map((booking) => booking.timeLog?.gateInAt ?? null)
      .filter((instant): instant is Date => instant !== null),
    settings
  )

  return {
    customer,
    from,
    to,
    kpi,
    rows,
    byDay,
    byHour,
    byActivity: buildByActivity(rows),
  }
}

reportsRouter.get('/my', customerOnly, async (req, res, next) => {
  try {
    const query = parse(customerRangeSchema, req.query, 'Rentang tanggal')
    assertReportRange(query.from, query.to)

    // Kepemilikan tidak pernah datang dari klien. Tanpa baris ini, seorang
    // customer bisa membaca laporan perusahaan lain lewat query string.
    const customerId = req.user?.customerId
    if (!customerId) throw forbidden('Akun tidak terhubung ke customer')

    const report = await buildCustomerReport(query.from, query.to, customerId)
    res.json({ data: report })
  } catch (error) {
    next(error)
  }
})

reportsRouter.get('/my/export.xlsx', customerOnly, async (req, res, next) => {
  try {
    const query = parse(customerRangeSchema, req.query, 'Rentang tanggal')
    assertReportRange(query.from, query.to)

    const customerId = req.user?.customerId
    if (!customerId) throw forbidden('Akun tidak terhubung ke customer')

    const lang: ReportLang = query.lang ?? 'id'
    const labels = REPORT_LABELS[lang]
    const col = labels.columns
    const report = await buildCustomerReport(
      query.from,
      query.to,
      customerId
    )

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Warehouse TSB'
    workbook.created = new Date()

    const summary = workbook.addWorksheet(labels.sheets.customerSummary)
    summary.columns = [
      { header: col.metric, key: 'metric', width: 34 },
      { header: col.value, key: 'value', width: 22 },
    ]
    summary.addRows([
      { metric: labels.metrics.customerName, value: report.customer.name },
      { metric: labels.metrics.customerCode, value: report.customer.code },
      {
        metric: labels.metrics.period,
        value: `${query.from} ${labels.rangeSeparator} ${query.to}`,
      },
      { metric: labels.metrics.totalBookings, value: report.kpi.totalBookings },
      { metric: labels.metrics.completed, value: report.kpi.completed },
      { metric: labels.metrics.cancelled, value: report.kpi.cancelled },
      { metric: labels.metrics.noShow, value: report.kpi.noShow },
      {
        metric: labels.metrics.expired,
        value: report.kpi.expiredPending,
      },
      { metric: labels.metrics.onTimeRate, value: report.kpi.onTimeRate },
      {
        metric: labels.metrics.averageWaiting,
        value: report.kpi.averageWaitingMinutes,
      },
      {
        metric: labels.metrics.averageProcessing,
        value: report.kpi.averageProcessingMinutes,
      },
      {
        metric: labels.metrics.averageTurnaround,
        value: report.kpi.averageTurnaroundMinutes,
      },
      {
        metric: labels.metrics.averageLate,
        value: report.kpi.averageLateMinutes,
      },
      {
        metric: labels.metrics.averageSlotUsed,
        value: report.kpi.averageSlotUsedPercent,
      },
      {
        metric: labels.metrics.overruns,
        value: report.kpi.overrunCount,
      },
    ])
    summary.getRow(1).font = { bold: true }
    summary.views = [{ state: 'frozen', ySplit: 1 }]

    const sheet = workbook.addWorksheet(labels.sheets.customerDetail)
    sheet.columns = [
      { header: col.bookingCode, key: 'bookingCode', width: 22 },
      { header: col.bookingDate, key: 'bookingDate', width: 12 },
      { header: col.activity, key: 'activity', width: 11 },
      { header: col.truckType, key: 'truckType', width: 18 },
      { header: col.licensePlate, key: 'licensePlate', width: 14 },
      { header: col.driver, key: 'driverName', width: 20 },
      { header: col.referenceDocNo, key: 'referenceDocNo', width: 20 },
      { header: col.dock, key: 'dockCode', width: 9 },
      { header: col.status, key: 'status', width: 22 },
      { header: col.approval, key: 'approvalStatus', width: 22 },
      { header: col.scheduledStart, key: 'scheduledStart', width: 20 },
      { header: col.gateInAt, key: 'gateInAt', width: 20 },
      { header: col.processStartedAt, key: 'processStartedAt', width: 20 },
      { header: col.processCompletedAt, key: 'processCompletedAt', width: 20 },
      { header: col.gateOutAt, key: 'gateOutAt', width: 20 },
      { header: col.waiting, key: 'waitingMinutes', width: 13 },
      { header: col.processing, key: 'processingMinutes', width: 13 },
      { header: col.turnaround, key: 'turnaroundMinutes', width: 16 },
      { header: col.late, key: 'lateMinutes', width: 15 },
      { header: col.blocks, key: 'blocksLocked', width: 8 },
      { header: col.slotMinutes, key: 'slotMinutes', width: 11 },
      { header: col.slotUsed, key: 'slotUsedPercent', width: 18 },
      { header: col.slotOverrun, key: 'slotOverrunMinutes', width: 16 },
    ]
    sheet.addRows(
      report.rows.map((row) => ({
        ...row,
        activity: activityTypeLabel(lang, row.activityType),
        status: bookingStatusLabel(lang, row.status),
        approvalStatus: approvalStatusLabel(lang, row.approvalStatus),
        licensePlate: row.licensePlate ?? '-',
        driverName: row.driverName ?? '-',
        dockCode: row.dockCode ?? '-',
      }))
    )
    sheet.getRow(1).font = { bold: true }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: 'A1', to: 'W1' }

    const daily = workbook.addWorksheet(labels.sheets.byDay)
    daily.columns = [
      { header: col.date, key: 'date', width: 12 },
      { header: col.total, key: 'total', width: 9 },
      { header: col.completed, key: 'completed', width: 10 },
      { header: col.late, key: 'late', width: 11 },
      {
        header: col.averageWaiting,
        key: 'averageWaitingMinutes',
        width: 22,
      },
      {
        header: col.averageProcessing,
        key: 'averageProcessingMinutes',
        width: 22,
      },
      {
        header: col.averageTurnaround,
        key: 'averageTurnaroundMinutes',
        width: 26,
      },
      {
        header: col.averageSlotUsed,
        key: 'averageSlotUsedPercent',
        width: 28,
      },
    ]
    daily.addRows(report.byDay)
    daily.getRow(1).font = { bold: true }
    daily.views = [{ state: 'frozen', ySplit: 1 }]
    daily.autoFilter = { from: 'A1', to: 'H1' }

    const fileName = `${reportFilePrefix(lang)}-${report.customer.code}-${query.from}-${query.to}.xlsx`
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
