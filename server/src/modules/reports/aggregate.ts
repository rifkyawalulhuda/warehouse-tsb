import { minuteOfDayJakarta } from '../../lib/time'

/**
 * Agregasi laporan dipakai dua kali: laporan staf (semua customer atau satu
 * customer) dan laporan customer. Sebelum ini keduanya punya salinan loop
 * sendiri, sehingga aturan seperti "baris tanpa durasi tidak menyeret
 * rata-rata ke nol" harus diubah di dua tempat dan gampang menyimpang.
 *
 * Semua fungsi di sini menerima baris yang sudah dinormalisasi dan hanya
 * mengembalikan angka. Pemanggil yang memilih bidang mana yang boleh keluar —
 * itulah tempat aturan "customer tidak melihat kapasitas gudang" ditegakkan.
 */
export type ReportRowLike = {
  bookingDate: string
  activityType: string
  status: string
  approvalStatus: string
  gateInAt: string | null
  dockCode?: string | null
  waitingMinutes: number | null
  processingMinutes: number | null
  turnaroundMinutes: number | null
  lateMinutes: number
  slotUsedPercent?: number | null
}

export type ReportKpi = {
  totalBookings: number
  completed: number
  cancelled: number
  noShow: number
  expiredPending: number
  onTimeRate: number
  averageWaitingMinutes: number
  averageProcessingMinutes: number
  averageTurnaroundMinutes: number
  averageLateMinutes: number
}

export type DaySummary = {
  date: string
  total: number
  completed: number
  late: number
  averageWaitingMinutes: number
  averageProcessingMinutes: number
  averageTurnaroundMinutes: number
  averageSlotUsedPercent: number
}

export type DockSummary = {
  dockCode: string
  activity: string
  trucks: number
  usedHours: number
  averageProcessingMinutes: number
  utilization: number
}

export type ArrivalHourSummary = { hour: number; label: string; arrivals: number }

/** Rata-rata dibulatkan; daftar kosong berarti 0, bukan NaN. */
export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

/** Buang nilai kosong tanpa memaksa pemanggil menulis type guard sendiri. */
export function notNull(values: readonly (number | null | undefined)[]): number[] {
  return values.filter((value): value is number => value !== null && value !== undefined)
}

/**
 * KPI yang sama untuk kedua laporan. `expiredPending` dihitung dari sumbu
 * approval, bukan status: booking seperti ini berakhir CANCELLED, tetapi
 * penyebabnya Admin yang tidak memutuskan sampai tenggat.
 */
export function buildKpi(rows: readonly ReportRowLike[]): ReportKpi {
  let completed = 0
  let cancelled = 0
  let noShow = 0
  let expiredPending = 0
  let gatedIn = 0
  let onTime = 0
  const waiting: number[] = []
  const processing: number[] = []
  const turnaround: number[] = []
  const late: number[] = []

  for (const row of rows) {
    if (row.status === 'CHECKED_OUT') completed += 1
    if (row.status === 'CANCELLED') cancelled += 1
    if (row.status === 'NO_SHOW') noShow += 1
    if (row.approvalStatus === 'EXPIRED') expiredPending += 1

    if (row.gateInAt !== null) {
      gatedIn += 1
      if (row.lateMinutes === 0) onTime += 1
    }
    if (row.lateMinutes > 0) late.push(row.lateMinutes)
    if (row.waitingMinutes !== null) waiting.push(row.waitingMinutes)
    if (row.processingMinutes !== null) processing.push(row.processingMinutes)
    if (row.turnaroundMinutes !== null) turnaround.push(row.turnaroundMinutes)
  }

  return {
    totalBookings: rows.length,
    completed,
    cancelled,
    noShow,
    expiredPending,
    onTimeRate: gatedIn === 0 ? 0 : Math.round((onTime / gatedIn) * 100),
    averageWaitingMinutes: average(waiting),
    averageProcessingMinutes: average(processing),
    averageTurnaroundMinutes: average(turnaround),
    averageLateMinutes: average(late),
  }
}

/**
 * Rekap per hari dalam satu lintasan. Rata-rata hanya memakai baris yang punya
 * durasi, supaya hari yang belum selesai tidak menyeret angka ke nol.
 */
export function buildByDay(rows: readonly ReportRowLike[]): DaySummary[] {
  type Accumulator = {
    date: string
    total: number
    completed: number
    late: number
    waiting: number[]
    processing: number[]
    turnaround: number[]
    slot: number[]
  }

  const byDate = new Map<string, Accumulator>()
  for (const row of rows) {
    const entry = byDate.get(row.bookingDate) ?? {
      date: row.bookingDate,
      total: 0,
      completed: 0,
      late: 0,
      waiting: [],
      processing: [],
      turnaround: [],
      slot: [],
    }

    entry.total += 1
    if (row.status === 'CHECKED_OUT') entry.completed += 1
    if (row.lateMinutes > 0) entry.late += 1
    if (row.waitingMinutes !== null) entry.waiting.push(row.waitingMinutes)
    if (row.processingMinutes !== null) entry.processing.push(row.processingMinutes)
    if (row.turnaroundMinutes !== null) entry.turnaround.push(row.turnaroundMinutes)
    if (row.slotUsedPercent !== null && row.slotUsedPercent !== undefined) {
      entry.slot.push(row.slotUsedPercent)
    }

    byDate.set(row.bookingDate, entry)
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      date: entry.date,
      total: entry.total,
      completed: entry.completed,
      late: entry.late,
      averageWaitingMinutes: average(entry.waiting),
      averageProcessingMinutes: average(entry.processing),
      averageTurnaroundMinutes: average(entry.turnaround),
      averageSlotUsedPercent: average(entry.slot),
    }))
}

export function buildByActivity(
  rows: readonly ReportRowLike[]
): { activity: 'LOADING' | 'UNLOADING'; total: number }[] {
  let loading = 0
  let unloading = 0
  for (const row of rows) {
    if (row.activityType === 'LOADING') loading += 1
    else if (row.activityType === 'UNLOADING') unloading += 1
  }
  return [
    { activity: 'LOADING', total: loading },
    { activity: 'UNLOADING', total: unloading },
  ]
}

/**
 * Kedatangan per jam operasional. Menerima waktu gate-in mentah karena jam
 * yang dipakai adalah jam Jakarta, bukan jam mesin.
 */
export function buildArrivalsByHour(
  gateInInstants: readonly Date[],
  window: { operatingStartMinute: number; operatingEndMinute: number }
): ArrivalHourSummary[] {
  const counts = new Map<number, number>()
  for (const instant of gateInInstants) {
    const hour = Math.floor(minuteOfDayJakarta(instant) / 60)
    counts.set(hour, (counts.get(hour) ?? 0) + 1)
  }

  const firstHour = Math.floor(window.operatingStartMinute / 60)
  const lastHour = Math.ceil(window.operatingEndMinute / 60)

  return Array.from({ length: Math.max(0, lastHour - firstHour) }, (_, index) => {
    const hour = firstHour + index
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}.00`,
      arrivals: counts.get(hour) ?? 0,
    }
  })
}

/**
 * Rekap per dock. Jam pakai dihitung dari waktu proses yang benar-benar
 * tercatat, lalu dibagi jam operasional x jumlah hari dalam rentang.
 *
 * `activity` diambil dari kumpulan aktivitas yang dilayani dock, bukan dari
 * baris pertama: dock `BOTH` yang kebetulan hanya dipakai bongkar hari itu
 * tetap dock serbaguna, dan menampilkannya sebagai "Bongkar" membuat jadwal
 * pemuatan terlihat seperti salah input.
 */
export function buildDockSummary(
  rows: readonly ReportRowLike[],
  options: { operatingHours: number; dayCount: number }
): DockSummary[] {
  type Accumulator = {
    dockCode: string
    activities: Set<string>
    trucks: number
    usedMinutes: number
    processing: number[]
  }

  const byDock = new Map<string, Accumulator>()
  for (const row of rows) {
    if (!row.dockCode) continue
    const entry = byDock.get(row.dockCode) ?? {
      dockCode: row.dockCode,
      activities: new Set<string>(),
      trucks: 0,
      usedMinutes: 0,
      processing: [],
    }

    entry.activities.add(row.activityType)
    entry.trucks += 1
    if (row.processingMinutes !== null) {
      entry.processing.push(row.processingMinutes)
      entry.usedMinutes += row.processingMinutes
    }

    byDock.set(row.dockCode, entry)
  }

  const availableMinutes = options.operatingHours * 60 * options.dayCount

  return [...byDock.values()]
    .sort((a, b) => a.dockCode.localeCompare(b.dockCode))
    .map((entry) => {
      const activities = [...entry.activities]
      return {
        dockCode: entry.dockCode,
        activity: activities.length > 1 ? 'BOTH' : (activities[0] ?? ''),
        trucks: entry.trucks,
        usedHours: Math.round((entry.usedMinutes / 60) * 10) / 10,
        averageProcessingMinutes: average(entry.processing),
        utilization:
          availableMinutes === 0
            ? 0
            : Math.min(100, Math.round((entry.usedMinutes / availableMinutes) * 100)),
      }
    })
}
