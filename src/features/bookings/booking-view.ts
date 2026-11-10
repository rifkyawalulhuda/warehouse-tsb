import type { Booking } from '@/lib/api/types'
import { TIME_ZONE, formatTime } from '@/lib/format'
import { getCookie, setCookie } from '@/lib/cookies'

/* ------------------------------------------------------------------ */
/* Pilihan tampilan                                                    */
/* ------------------------------------------------------------------ */

export type BookingsView = 'list' | 'grid' | 'schedule'

const VIEW_COOKIE = 'bookings_view'
const VIEW_MAX_AGE = 60 * 60 * 24 * 30 // 30 hari

const VIEWS: BookingsView[] = ['list', 'grid', 'schedule']

/**
 * Nilai cookie yang tidak dikenal (mis. sisa versi lama) jatuh ke `list`, bukan
 * `undefined`, supaya halaman tidak pernah merender tanpa tampilan terpilih.
 */
export function parseViewMode(value: string | undefined): BookingsView {
  return VIEWS.includes(value as BookingsView) ? (value as BookingsView) : 'list'
}

export function readViewMode(): BookingsView {
  return parseViewMode(getCookie(VIEW_COOKIE))
}

export function saveViewMode(view: BookingsView): void {
  setCookie(VIEW_COOKIE, view, VIEW_MAX_AGE)
}

/* ------------------------------------------------------------------ */
/* Filter cepat                                                        */
/* ------------------------------------------------------------------ */

export type BookingFilter = 'all' | 'action' | 'ready' | 'onsite' | 'done' | 'cancelled' | 'noshow'

/** Chip untuk tab Aktif: yang masih bisa dikerjakan atau ditunggu. */
export const ACTIVE_FILTERS: BookingFilter[] = ['all', 'action', 'ready', 'onsite']

/** Chip untuk tab Riwayat: hasil akhir sebuah booking. */
export const PAST_FILTERS: BookingFilter[] = ['all', 'done', 'cancelled', 'noshow']

export const BOOKING_FILTERS: { value: BookingFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'action', label: 'Perlu tindakan' },
  { value: 'ready', label: 'Siap datang' },
  { value: 'onsite', label: 'Di gudang' },
  { value: 'done', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
  { value: 'noshow', label: 'Tidak hadir' },
]

export function filtersFor(scope: 'active' | 'past'): BookingFilter[] {
  return scope === 'active' ? ACTIVE_FILTERS : PAST_FILTERS
}

const ONSITE_STATUSES = [
  'CHECKED_IN_ON_TIME',
  'LATE_WAITING_LIST',
  'DOCK_ASSIGNED',
  'IN_PROGRESS',
] as const

/**
 * Booking butuh tindakan customer bila datanya belum lengkap atau sedang
 * menunggu keputusan Admin. `REJECTED`/`EXPIRED` tidak masuk hitungan: slotnya
 * sudah tidak bisa dipakai, jadi tidak ada yang bisa dikerjakan di halaman ini.
 */
export function needsAction(booking: Booking): boolean {
  return (
    booking.status === 'BOOKED_INCOMPLETE' ||
    booking.approvalStatus === 'PENDING'
  )
}

export function isOnSite(booking: Booking): boolean {
  return (ONSITE_STATUSES as readonly string[]).includes(booking.status)
}

export function matchesFilter(booking: Booking, filter: BookingFilter): boolean {
  switch (filter) {
    case 'action':
      return needsAction(booking)
    case 'ready':
      return booking.status === 'BOOKED_READY' || booking.approvalStatus === 'APPROVED'
    case 'onsite':
      return isOnSite(booking)
    case 'done':
      return booking.status === 'COMPLETED' || booking.status === 'CHECKED_OUT'
    case 'cancelled':
      return booking.status === 'CANCELLED'
    case 'noshow':
      return booking.status === 'NO_SHOW'
    case 'all':
      return true
  }
}

export function filterCounts(bookings: Booking[]): Record<BookingFilter, number> {
  const counts: Record<BookingFilter, number> = {
    all: bookings.length,
    action: 0,
    ready: 0,
    onsite: 0,
    done: 0,
    cancelled: 0,
    noshow: 0,
  }
  for (const booking of bookings) {
    if (matchesFilter(booking, 'action')) counts.action += 1
    if (matchesFilter(booking, 'ready')) counts.ready += 1
    if (matchesFilter(booking, 'onsite')) counts.onsite += 1
    if (matchesFilter(booking, 'done')) counts.done += 1
    if (matchesFilter(booking, 'cancelled')) counts.cancelled += 1
    if (matchesFilter(booking, 'noshow')) counts.noshow += 1
  }
  return counts
}

/* ------------------------------------------------------------------ */
/* Booking berikutnya                                                  */
/* ------------------------------------------------------------------ */

/**
 * Booking aktif pertama yang jamnya belum lewat. Server sudah mengurutkan naik
 * berdasarkan `startTime`, tetapi perbandingan eksplisit di sini membuat fungsi
 * ini tetap benar untuk masukan yang tidak terurut (mis. hasil filter lokal).
 */
export function pickNextBooking(bookings: Booking[], now: Date): Booking | null {
  const current = now.getTime()
  let next: Booking | null = null
  let nextStart = Number.POSITIVE_INFINITY

  for (const booking of bookings) {
    const start = Date.parse(booking.startTime)
    const end = Date.parse(booking.endTime)
    if (Number.isNaN(start) || Number.isNaN(end)) continue
    if (end <= current) continue
    if (start < nextStart) {
      next = booking
      nextStart = start
    }
  }

  return next
}

export type UrgencyKey = 'in-progress' | 'imminent' | 'today' | 'upcoming' | 'overdue'

export type Urgency = {
  key: UrgencyKey
  label: string
  /** Versi pendek untuk badge, tanpa mengulang jam yang sudah tampil besar. */
  badge: string
}

/** Tanggal kalender Jakarta sebagai `YYYY-MM-DD`. */
function dayKey(value: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function dayDistance(from: number, to: number): number {
  const a = Date.parse(`${dayKey(from)}T00:00:00.000Z`)
  const b = Date.parse(`${dayKey(to)}T00:00:00.000Z`)
  return Math.round((b - a) / 86_400_000)
}

/**
 * Label waktu relatif untuk blok booking berikutnya. Satuan menit dipakai
 * sampai satu jam, setelah itu hari lebih mudah dicerna daripada "1.440 menit".
 */
export function bookingUrgency(booking: Booking, now: Date): Urgency {
  const start = Date.parse(booking.startTime)
  const end = Date.parse(booking.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { key: 'upcoming', label: 'Jadwal tidak terbaca', badge: 'Jadwal tidak terbaca' }
  }

  const current = now.getTime()
  if (current >= end) return { key: 'overdue', label: 'Jam sudah lewat', badge: 'Jam sudah lewat' }
  if (current >= start) {
    return { key: 'in-progress', label: 'Sedang berlangsung', badge: 'Sedang berlangsung' }
  }

  const minutes = Math.round((start - current) / 60_000)
  if (minutes <= 0) return { key: 'imminent', label: 'Waktunya masuk', badge: 'Waktunya masuk' }
  if (minutes < 60) {
    return {
      key: 'imminent',
      label: `Masuk dalam ${minutes} menit`,
      badge: `Masuk dalam ${minutes} menit`,
    }
  }

  const days = dayDistance(current, start)
  if (days <= 0) {
    return {
      key: 'today',
      label: `Hari ini, ${formatTime(booking.startTime)}`,
      badge: 'Hari ini',
    }
  }
  if (days === 1) {
    return {
      key: 'today',
      label: `Besok, ${formatTime(booking.startTime)}`,
      badge: 'Besok',
    }
  }
  return { key: 'upcoming', label: `${days} hari lagi`, badge: `${days} hari lagi` }
}

/* ------------------------------------------------------------------ */
/* Label bersama                                                       */
/* ------------------------------------------------------------------ */

/**
 * Satu sebutan dock untuk semua tampilan. Tanpa ini, kartu menulis "Belum
 * ditentukan", baris menulis "Belum ada dock", dan blok berikutnya menulis
 * "Ditentukan saat check-in" — tiga bunyi berbeda untuk satu keadaan yang sama.
 */
export function dockLabel(booking: Booking): string {
  return booking.assignedDock?.dockCode ?? 'Ditentukan saat check-in'
}

/* ------------------------------------------------------------------ */
/* Pengelompokan per hari                                              */
/* ------------------------------------------------------------------ */

export type BookingDay = {
  date: string
  label: string
  items: Booking[]
}

/**
 * Mengelompokkan booking berdasarkan `bookingDate` dengan urutan kemunculan
 * dipertahankan, sehingga tampilan jadwal mengikuti urutan dari server
 * (naik untuk aktif, turun untuk riwayat).
 */
export function groupByDay(bookings: Booking[]): BookingDay[] {
  const days: BookingDay[] = []
  const index = new Map<string, BookingDay>()

  for (const booking of bookings) {
    const date = booking.bookingDate.slice(0, 10)
    let day = index.get(date)
    if (!day) {
      day = { date, label: dayLabel(date), items: [] }
      index.set(date, day)
      days.push(day)
    }
    day.items.push(booking)
  }

  return days
}

function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(parsed)
}
