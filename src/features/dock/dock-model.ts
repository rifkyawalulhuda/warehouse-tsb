import { bookingDurationMinutes } from '@/lib/format'
import type { MessageKey, Vars } from '@/lib/i18n'
import type { Booking, DockWithBooking, QueueResponse } from '@/lib/api/types'

/** Penerjemah yang dipakai fungsi model; sama bentuknya dengan `useT()`. */
export type Translate = (key: MessageKey, vars?: Vars) => string

/**
 * Keadaan satu dock dilihat dari sudut checker. `starting` berarti truk sudah
 * ditempatkan ke dock tetapi proses belum dimulai — satu-satunya keadaan yang
 * menunggu tindakan checker.
 */
export type DockPhase = 'starting' | 'serving' | 'available' | 'maintenance'

export const dockFilters = [
  'all',
  'action',
  'serving',
  'empty',
  'maintenance',
] as const

export type DockFilter = (typeof dockFilters)[number]

export const dockFilterLabelKeys: Record<DockFilter, MessageKey> = {
  all: 'dock.filter.all',
  action: 'dock.filter.action',
  serving: 'dock.filter.serving',
  empty: 'dock.filter.empty',
  maintenance: 'dock.filter.maintenance',
}

export function dockPhase(dock: DockWithBooking): DockPhase {
  if (dock.currentStatus === 'MAINTENANCE') return 'maintenance'
  if (dock.currentBooking?.status === 'IN_PROGRESS') return 'serving'
  if (dock.currentBooking?.status === 'DOCK_ASSIGNED') return 'starting'
  return 'available'
}

export const dockPhaseLabelKeys: Record<DockPhase, MessageKey> = {
  starting: 'dock.phase.starting',
  serving: 'dock.phase.serving',
  available: 'dock.phase.available',
  maintenance: 'dock.phase.maintenance',
}

export const dockGroupLabelKeys: Record<DockPhase, MessageKey> = {
  starting: 'dock.group.starting',
  serving: 'dock.group.serving',
  available: 'dock.group.available',
  maintenance: 'dock.group.maintenance',
}

export function dockActivityLabelKey(
  activity: DockWithBooking['allowedActivity']
): MessageKey {
  if (activity === 'BOTH') return 'dock.activityBoth'
  return activity === 'LOADING' ? 'dock.activityLoading' : 'dock.activityUnloading'
}

export function dockFilterCounts(docks: DockWithBooking[]) {
  const counts: Record<DockFilter, number> = {
    all: docks.length,
    action: 0,
    serving: 0,
    empty: 0,
    maintenance: 0,
  }

  for (const dock of docks) {
    const phase = dockPhase(dock)
    if (phase === 'starting') counts.action += 1
    else if (phase === 'serving') counts.serving += 1
    else if (phase === 'available') counts.empty += 1
    else counts.maintenance += 1
  }

  return counts
}

function matchesFilter(dock: DockWithBooking, filter: DockFilter) {
  if (filter === 'all') return true
  if (filter === 'action') return dockPhase(dock) === 'starting'
  if (filter === 'serving') return dockPhase(dock) === 'serving'
  if (filter === 'empty') return dockPhase(dock) === 'available'
  return dockPhase(dock) === 'maintenance'
}

/**
 * Pencarian mencakup apa saja yang mungkin dibaca checker dari kartu: kode
 * dock, nama area, kode booking, plat, perusahaan, dan nama supir. Huruf
 * besar/kecil dan spasi tepi tidak membedakan.
 */
export function matchesDockQuery(dock: DockWithBooking, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const booking = dock.currentBooking
  const haystack = [
    dock.dockCode,
    dock.areaName,
    booking?.bookingCode,
    booking?.licensePlate,
    booking?.driverName,
    booking?.customer.name,
  ]

  return haystack.some((value) => value?.toLowerCase().includes(query))
}

export type DockGroup = { phase: DockPhase; docks: DockWithBooking[] }

/**
 * Mengelompokkan dock sesuai urutan kerja checker: yang menunggu dimulai lebih
 * dulu, lalu yang sedang diproses, lalu yang kosong, dan perawatan paling
 * akhir. Kelompok kosong tidak ikut dikembalikan supaya judul bagian tidak
 * muncul tanpa isi.
 */
export function groupDocks(
  docks: DockWithBooking[],
  filter: DockFilter,
  query: string
): DockGroup[] {
  const order: DockPhase[] = ['starting', 'serving', 'available', 'maintenance']
  const groups = new Map<DockPhase, DockWithBooking[]>(
    order.map((phase) => [phase, []])
  )

  for (const dock of docks) {
    if (!matchesFilter(dock, filter)) continue
    if (!matchesDockQuery(dock, query)) continue
    groups.get(dockPhase(dock))!.push(dock)
  }

  return order
    .map((phase) => ({ phase, docks: groups.get(phase)! }))
    .filter((group) => group.docks.length > 0)
}

export type ProcessClock = {
  elapsedMinutes: number
  targetMinutes: number
  remainingMinutes: number
  overrunMinutes: number
  ratio: number
  tone: 'on-track' | 'near' | 'over'
}

/**
 * Jam proses dihitung di klien dari `processStartedAt`, bukan dari jam server
 * yang bisa tertinggal. Target memakai snapshot jadwal booking
 * (`start_time`–`end_time`), sehingga perubahan jenis truk tidak menggeser
 * garis target booking lama.
 */
export function processClock(booking: Booking, now: Date): ProcessClock {
  const targetMinutes = bookingDurationMinutes(booking)
  const startedAt = booking.timeLog?.processStartedAt
  const elapsedMinutes = startedAt
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(startedAt)) / 60_000))
    : 0
  const ratio = targetMinutes > 0 ? elapsedMinutes / targetMinutes : 0

  return {
    elapsedMinutes,
    targetMinutes,
    remainingMinutes: Math.max(0, targetMinutes - elapsedMinutes),
    overrunMinutes: Math.max(0, elapsedMinutes - targetMinutes),
    ratio,
    tone: ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'on-track',
  }
}

/** Label jam ringkas untuk ruang sempit: "3j 35m" alih-alih "3 j 35 mnt". */
export function shortClock(minutes: number, t: Translate) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return t('dock.shortMinutes', { count: rest })
  return rest === 0
    ? t('dock.shortHours', { count: hours })
    : `${t('dock.shortHours', { count: hours })} ${t('dock.shortMinutes', { count: rest })}`
}

export function clockLabel(minutes: number, t: Translate) {
  if (minutes < 60) return t('dock.clockMinutes', { count: minutes })
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? t('dock.clockHours', { count: hours })
    : t('dock.clockBoth', { hours, minutes: String(rest).padStart(2, '0') })
}

export function waitingCount(queue: QueueResponse | undefined) {
  if (!queue) return 0
  return queue.onTime.length + queue.late.length
}
