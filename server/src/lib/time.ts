import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

/** Semua jam operasional dihitung di zona ini; timestamp disimpan UTC. */
export const TZ = 'Asia/Jakarta'

export type DateISO = string // YYYY-MM-DD

export function todayISO(): DateISO {
  return dayjs().tz(TZ).format('YYYY-MM-DD')
}

export function isDateISO(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value, 'YYYY-MM-DD').isValid()
}

/** `@db.Date` di Prisma memakai tengah malam UTC; jangan pakai zona lokal di sini. */
export function dateOnlyToUtc(iso: DateISO): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

export function utcToDateOnly(value: Date): DateISO {
  return value.toISOString().slice(0, 10)
}

/** Instant UTC untuk sebuah jam operasional (menit dari tengah malam) pada tanggal tertentu. */
export function jakartaInstant(iso: DateISO, minuteOfDay: number): Date {
  return dayjs.tz(`${iso}T00:00:00`, TZ).add(minuteOfDay, 'minute').toDate()
}

/** Menit dari tengah malam waktu Jakarta untuk sebuah instant. */
export function minuteOfDayJakarta(value: Date): number {
  const local = dayjs(value).tz(TZ)
  return local.hour() * 60 + local.minute()
}

export function minuteToLabel(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function labelToMinute(label: string): number {
  const [h, m] = label.split(':')
  const hours = Number(h)
  const minutes = Number(m)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new RangeError(`Format jam tidak valid: ${label}`)
  }
  return hours * 60 + minutes
}

/** Selisih menit (b - a), dibulatkan ke bawah, tidak pernah negatif. */
export function diffMinutes(a: Date | null | undefined, b: Date | null | undefined): number | null {
  if (!a || !b) return null
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000))
}

export function addDaysISO(iso: DateISO, days: number): DateISO {
  return dayjs.tz(`${iso}T00:00:00`, TZ).add(days, 'day').format('YYYY-MM-DD')
}
