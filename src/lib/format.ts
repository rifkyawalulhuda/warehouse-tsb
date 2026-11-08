import type { BookingStatus, Role } from './api/types'

/** Zona waktu operasional. Semua label jam di UI memakai Asia/Jakarta. */
export const TIME_ZONE = 'Asia/Jakarta'

const DASH = '-'

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatTime(value: string | Date | null | undefined) {
  const date = toDate(value)
  if (!date) return DASH
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date)
}

export function formatDate(value: string | Date | null | undefined) {
  const date = toDate(value)
  if (!date) return DASH
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

export function formatDateShort(value: string | Date | null | undefined) {
  const date = toDate(value)
  if (!date) return DASH
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined) {
  const date = toDate(value)
  if (!date) return DASH
  return `${formatDateShort(date)} ${formatTime(date)}`
}

/** `minute` adalah menit sejak tengah malam waktu Jakarta. */
export function minuteToLabel(minute: number) {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function labelToMinute(label: string) {
  const [h, m] = label.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** Tanggal hari ini dalam format YYYY-MM-DD menurut zona Jakarta. */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDaysISO(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} menit`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} jam` : `${h} jam ${m} menit`
}

/**
 * Durasi sebuah booking diambil dari selisih `start_time` dan `end_time`,
 * bukan dari `truck_types.duration_minutes`. `end_time` di-snapshot saat booking
 * dibuat, jadi tampilan tidak ikut berubah ketika Admin mengedit jenis truk.
 */
export function bookingDurationMinutes(booking: {
  startTime: string
  endTime: string
}): number {
  const start = Date.parse(booking.startTime)
  const end = Date.parse(booking.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.round((end - start) / 60_000))
}

export const statusLabels: Record<BookingStatus, string> = {
  BOOKED_INCOMPLETE: 'Menunggu data kendaraan',
  BOOKED_READY: 'Siap masuk',
  CHECKED_IN_ON_TIME: 'Check-in tepat waktu',
  LATE_WAITING_LIST: 'Antrean terlambat',
  DOCK_ASSIGNED: 'Dapat dock',
  IN_PROGRESS: 'Sedang diproses',
  COMPLETED: 'Selesai bongkar/muat',
  CHECKED_OUT: 'Sudah keluar',
  CANCELLED: 'Dibatalkan',
  NO_SHOW: 'Tidak datang',
}

export const statusTone: Record<BookingStatus, string> = {
  BOOKED_INCOMPLETE:
    'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
  BOOKED_READY:
    'border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300',
  CHECKED_IN_ON_TIME:
    'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  LATE_WAITING_LIST:
    'border-orange-300/70 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-300',
  DOCK_ASSIGNED:
    'border-violet-300/70 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300',
  IN_PROGRESS:
    'border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300',
  COMPLETED:
    'border-teal-300/70 bg-teal-50 text-teal-800 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300',
  CHECKED_OUT: 'border-border bg-muted text-muted-foreground',
  CANCELLED: 'border-border bg-muted text-muted-foreground line-through',
  NO_SHOW:
    'border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
}

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin Gudang',
  CUSTOMER: 'Customer',
  GATE_OFFICER: 'Petugas Gate',
  CHECKER: 'Checker Dock',
}

export const activityLabels = {
  LOADING: 'Loading (muat)',
  UNLOADING: 'Unloading (bongkar)',
} as const

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Nomor WA dalam format internasional tanpa tanda baca. */
export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return digits
}
