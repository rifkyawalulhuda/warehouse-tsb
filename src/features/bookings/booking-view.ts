import type { Booking, SlotLimit } from '@/lib/api/types'
import { getCookie, setCookie } from '@/lib/cookies'
import { dockWithArea } from '@/lib/dock-label'
import { TIME_ZONE, formatTime } from '@/lib/format'
import { translate, type Locale, type MessageKey } from '@/lib/i18n'

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
  return VIEWS.includes(value as BookingsView)
    ? (value as BookingsView)
    : 'list'
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

export type BookingFilter =
  'all' | 'action' | 'ready' | 'onsite' | 'done' | 'cancelled' | 'noshow'

/** Chip untuk tab Aktif: yang masih bisa dikerjakan atau ditunggu. */
export const ACTIVE_FILTERS: BookingFilter[] = [
  'all',
  'action',
  'ready',
  'onsite',
]

/** Chip untuk tab Riwayat: hasil akhir sebuah booking. */
export const PAST_FILTERS: BookingFilter[] = [
  'all',
  'done',
  'cancelled',
  'noshow',
]

export const BOOKING_FILTERS: { value: BookingFilter; key: MessageKey }[] = [
  { value: 'all', key: 'bookings.filter.all' },
  { value: 'action', key: 'bookings.filter.action' },
  { value: 'ready', key: 'bookings.filter.ready' },
  { value: 'onsite', key: 'bookings.filter.onsite' },
  { value: 'done', key: 'bookings.filter.done' },
  { value: 'cancelled', key: 'bookings.filter.cancelled' },
  { value: 'noshow', key: 'bookings.filter.noshow' },
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

/** Status yang sudah selesai — tidak ada lagi yang bisa dikerjakan. */
const TERMINAL_STATUSES: readonly string[] = [
  'COMPLETED',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]

/**
 * Booking butuh tindakan customer bila datanya belum lengkap atau sedang
 * menunggu keputusan Admin. Booking yang sudah berakhir tidak masuk hitungan:
 * slotnya sudah tidak bisa dipakai, jadi tidak ada yang bisa dikerjakan di
 * halaman ini.
 *
 * Status terminal WAJIB ikut disaring, bukan hanya `approvalStatus`. Booking
 * yang dibatalkan customer tetap ber-`approval_status = PENDING` (persetujuan
 * tidak pernah selesai), jadi tanpa saringan ini booking batal muncul di
 * "Perlu tindakan" selamanya dengan label "Menunggu persetujuan".
 */
export function needsAction(booking: Booking): boolean {
  if (TERMINAL_STATUSES.includes(booking.status)) return false
  return (
    booking.status === 'BOOKED_INCOMPLETE' ||
    booking.approvalStatus === 'PENDING'
  )
}

export function isOnSite(booking: Booking): boolean {
  return (ONSITE_STATUSES as readonly string[]).includes(booking.status)
}

export function matchesFilter(
  booking: Booking,
  filter: BookingFilter
): boolean {
  switch (filter) {
    case 'action':
      return needsAction(booking)
    case 'ready':
      return (
        booking.status === 'BOOKED_READY' ||
        booking.approvalStatus === 'APPROVED'
      )
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

export function filterCounts(
  bookings: Booking[]
): Record<BookingFilter, number> {
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
export function pickNextBooking(
  bookings: Booking[],
  now: Date
): Booking | null {
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

export type UrgencyKey =
  'in-progress' | 'imminent' | 'today' | 'upcoming' | 'overdue'

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
export function bookingUrgency(
  booking: Booking,
  now: Date,
  locale: Locale = 'id'
): Urgency {
  const t = (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars)
  const start = Date.parse(booking.startTime)
  const end = Date.parse(booking.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      key: 'upcoming',
      label: t('bookings.urgency.unreadable'),
      badge: t('bookings.urgency.unreadable'),
    }
  }

  const current = now.getTime()
  if (current >= end) {
    return {
      key: 'overdue',
      label: t('bookings.urgency.overdue'),
      badge: t('bookings.urgency.overdue'),
    }
  }
  if (current >= start) {
    return {
      key: 'in-progress',
      label: t('bookings.urgency.inProgress'),
      badge: t('bookings.urgency.inProgress'),
    }
  }

  const minutes = Math.round((start - current) / 60_000)
  if (minutes <= 0) {
    return {
      key: 'imminent',
      label: t('bookings.urgency.imminent'),
      badge: t('bookings.urgency.imminent'),
    }
  }
  if (minutes < 60) {
    const label = t('bookings.urgency.inMinutes', { count: minutes })
    return { key: 'imminent', label, badge: label }
  }

  const days = dayDistance(current, start)
  if (days <= 0) {
    return {
      key: 'today',
      label: `${t('bookings.urgency.today')}, ${formatTime(booking.startTime)}`,
      badge: t('bookings.urgency.today'),
    }
  }
  if (days === 1) {
    return {
      key: 'today',
      label: `${t('bookings.urgency.tomorrow')}, ${formatTime(booking.startTime)}`,
      badge: t('bookings.urgency.tomorrow'),
    }
  }
  const label = t('bookings.urgency.daysLeft', { count: days })
  return { key: 'upcoming', label, badge: label }
}

/* ------------------------------------------------------------------ */
/* Label bersama                                                       */
/* ------------------------------------------------------------------ */

/**
 * Satu sebutan dock untuk semua tampilan. Tanpa ini, kartu menulis "Belum
 * ditentukan", baris menulis "Belum ada dock", dan blok berikutnya menulis
 * "Ditentukan saat check-in" — tiga bunyi berbeda untuk satu keadaan yang sama.
 */
export function dockLabel(booking: Booking, locale: Locale = 'id'): string {
  if (!booking.assignedDock) return translate(locale, 'bookings.dockTbd')
  return dockWithArea(booking.assignedDock)
}

/**
 * Sebab sebuah slot tidak bisa dipilih, dalam bahasa aktif.
 *
 * Server mengirim kode (`SlotLimit`), bukan kalimat, supaya layar berbahasa
 * Inggris tidak menampilkan teks Indonesia. Slot penuh tanpa sebab yang
 * dikenali tetap mendapat kata umum, bukan baris kosong.
 */
export function slotLimitLabel(
  limit: SlotLimit | null,
  locale: Locale = 'id'
): string {
  switch (limit?.code) {
    case 'PAST_START':
      return translate(locale, 'bookings.create.limit.pastStart')
    case 'NO_DOCK':
      return translate(locale, 'bookings.create.limit.noDock')
    case 'CLOSING_SOON':
      return translate(locale, 'bookings.create.limit.closingSoon')
    case 'BLOCK_FULL':
      return translate(locale, 'bookings.create.limit.blockFull', {
        time: limit.blockLabel,
      })
    default:
      return translate(locale, 'bookings.create.full')
  }
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
export function groupByDay(
  bookings: Booking[],
  locale: Locale = 'id'
): BookingDay[] {
  const days: BookingDay[] = []
  const index = new Map<string, BookingDay>()

  for (const booking of bookings) {
    const date = booking.bookingDate.slice(0, 10)
    let day = index.get(date)
    if (!day) {
      day = { date, label: dayLabel(date, locale), items: [] }
      index.set(date, day)
      days.push(day)
    }
    day.items.push(booking)
  }

  return days
}

function dayLabel(date: string, locale: Locale = 'id'): string {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(parsed)
}
