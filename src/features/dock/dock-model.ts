import { bookingDurationMinutes } from '@/lib/format'
import type { Booking, DockWithBooking, QueueResponse } from '@/lib/api/types'

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

export const dockFilterLabels: Record<DockFilter, string> = {
  all: 'Semua',
  action: 'Perlu dimulai',
  serving: 'Diproses',
  empty: 'Kosong',
  maintenance: 'Perawatan',
}

export function dockPhase(dock: DockWithBooking): DockPhase {
  if (dock.currentStatus === 'MAINTENANCE') return 'maintenance'
  if (dock.currentBooking?.status === 'IN_PROGRESS') return 'serving'
  if (dock.currentBooking?.status === 'DOCK_ASSIGNED') return 'starting'
  return 'available'
}

export const dockPhaseLabels: Record<DockPhase, string> = {
  starting: 'Siap dimulai',
  serving: 'Sedang diproses',
  available: 'Tersedia',
  maintenance: 'Perawatan',
}

export function dockActivityLabel(activity: DockWithBooking['allowedActivity']) {
  if (activity === 'BOTH') return 'Bongkar & muat'
  return activity === 'LOADING' ? 'Muat saja' : 'Bongkar saja'
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
 * dock, kode booking, plat, perusahaan, dan nama supir. Huruf besar/kecil dan
 * spasi tepi tidak membedakan.
 */
export function matchesDockQuery(dock: DockWithBooking, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true

  const booking = dock.currentBooking
  const haystack = [
    dock.dockCode,
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

/** Ringkas menit menjadi "42 mnt" atau "1 j 05 mnt" tanpa kata "jam" panjang. */
export function clockLabel(minutes: number) {
  if (minutes < 60) return `${minutes} mnt`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} j` : `${hours} j ${String(rest).padStart(2, '0')} mnt`
}

export function waitingCount(queue: QueueResponse | undefined) {
  if (!queue) return 0
  return queue.onTime.length + queue.late.length
}
