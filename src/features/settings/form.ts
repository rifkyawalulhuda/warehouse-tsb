import type { Settings } from '@/lib/api/types'
import { labelToMinute } from '@/lib/format'

/**
 * Bentuk state form Pengaturan. Angka disimpan sebagai string karena input
 * angka yang dikosongkan bernilai `''`, bukan `0` — menyimpannya sebagai number
 * akan membuat field kosong diam-diam tersimpan sebagai nol.
 */
export type FormState = {
  warehouseName: string
  open: string
  close: string
  slotUnitMinutes: string
  gracePeriodMinutes: string
  earlyArrivalLimitMinutes: string
  bookingWindowDays: string
  approvalMode: Settings['approvalMode']
  approvalLeadMinutes: string
  approvalMinDecisionMinutes: string
  approvalUrgentBufferMinutes: string
}

/** Seksi yang disimpan lewat `PUT /api/settings`, satu permintaan per seksi. */
export type SectionKey =
  'identity' | 'hours' | 'arrival' | 'window' | 'approval'

export const FIELD_GROUPS = {
  identity: ['warehouseName'],
  hours: ['open', 'close', 'slotUnitMinutes'],
  arrival: ['gracePeriodMinutes', 'earlyArrivalLimitMinutes'],
  window: ['bookingWindowDays'],
  approval: [
    'approvalMode',
    'approvalLeadMinutes',
    'approvalMinDecisionMinutes',
    'approvalUrgentBufferMinutes',
  ],
} as const satisfies Record<SectionKey, readonly (keyof FormState)[]>

export const SECTION_KEYS = Object.keys(FIELD_GROUPS) as SectionKey[]

export const ALL_FIELDS = SECTION_KEYS.flatMap(
  (section) => FIELD_GROUPS[section] as readonly (keyof FormState)[]
)

export type SettingsPayload = {
  warehouseName?: string
  operatingStartMinute?: number
  operatingEndMinute?: number
  slotUnitMinutes?: number
  gracePeriodMinutes?: number
  earlyArrivalLimitMinutes?: number
  bookingWindowDays?: number
  approvalMode?: Settings['approvalMode']
  approvalLeadMinutes?: number
  approvalMinDecisionMinutes?: number
  approvalUrgentBufferMinutes?: number
}

export function toForm(settings: Settings): FormState {
  return {
    warehouseName: settings.warehouseName,
    open: settings.operatingStartLabel,
    close: settings.operatingEndLabel,
    slotUnitMinutes: String(settings.slotUnitMinutes),
    gracePeriodMinutes: String(settings.gracePeriodMinutes),
    earlyArrivalLimitMinutes: String(settings.earlyArrivalLimitMinutes),
    bookingWindowDays: String(settings.bookingWindowDays),
    approvalMode: settings.approvalMode,
    approvalLeadMinutes: String(settings.approvalLeadMinutes),
    approvalMinDecisionMinutes: String(settings.approvalMinDecisionMinutes),
    approvalUrgentBufferMinutes: String(settings.approvalUrgentBufferMinutes),
  }
}

/**
 * Mengembalikan satu seksi ke nilai tersimpan tanpa menyentuh draf seksi lain.
 * Ditulis eksplisit per seksi supaya tipe tiap field tetap diperiksa compiler.
 */
export function restoreSection(
  current: FormState,
  saved: FormState,
  section: SectionKey
): FormState {
  switch (section) {
    case 'identity':
      return { ...current, warehouseName: saved.warehouseName }
    case 'hours':
      return {
        ...current,
        open: saved.open,
        close: saved.close,
        slotUnitMinutes: saved.slotUnitMinutes,
      }
    case 'arrival':
      return {
        ...current,
        gracePeriodMinutes: saved.gracePeriodMinutes,
        earlyArrivalLimitMinutes: saved.earlyArrivalLimitMinutes,
      }
    case 'window':
      return { ...current, bookingWindowDays: saved.bookingWindowDays }
    case 'approval':
      return {
        ...current,
        approvalMode: saved.approvalMode,
        approvalLeadMinutes: saved.approvalLeadMinutes,
        approvalMinDecisionMinutes: saved.approvalMinDecisionMinutes,
        approvalUrgentBufferMinutes: saved.approvalUrgentBufferMinutes,
      }
  }
}

export function isDirty(
  section: SectionKey,
  form: FormState,
  saved: FormState
) {
  return (FIELD_GROUPS[section] as readonly (keyof FormState)[]).some(
    (field) => form[field] !== saved[field]
  )
}

export function dirtySections(form: FormState, saved: FormState) {
  return SECTION_KEYS.filter((section) => isDirty(section, form, saved))
}

/* ----------------------------- validasi ----------------------------- */

/** Angka bulat dalam rentang; string kosong selalu ditolak, termasuk untuk min 0. */
function isIntegerIn(value: string, min: number, max: number) {
  const trimmed = value.trim()
  if (trimmed === '') return false
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

function minutesBetween(open: string, close: string) {
  if (open === '' || close === '') return null
  const start = labelToMinute(open)
  const end = labelToMinute(close)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return end - start
}

/**
 * Pesan galat untuk satu seksi, atau `null` bila siap disimpan. Pesan ini
 * muncul di kaki kartu seksi, bukan sebagai toast, supaya admin melihat field
 * mana yang bermasalah tanpa kehilangan konteks.
 */
export function sectionError(
  section: SectionKey,
  form: FormState
): string | null {
  switch (section) {
    case 'identity': {
      const name = form.warehouseName.trim()
      if (name.length < 2) return 'Nama gudang minimal 2 karakter.'
      if (name.length > 120) return 'Nama gudang maksimal 120 karakter.'
      return null
    }
    case 'hours': {
      if (!isIntegerIn(form.slotUnitMinutes, 15, 120)) {
        return 'Satuan blok harus angka 15–120 menit.'
      }
      const span = minutesBetween(form.open, form.close)
      if (span === null) return 'Jam buka dan jam tutup wajib diisi.'
      if (span <= 0) return 'Jam tutup harus setelah jam buka.'
      const unit = Number(form.slotUnitMinutes)
      if (span % unit !== 0) {
        return `Rentang ${span} menit tidak habis dibagi satuan blok ${unit} menit.`
      }
      return null
    }
    case 'arrival': {
      if (!isIntegerIn(form.gracePeriodMinutes, 0, 240)) {
        return 'Masa tenggang harus 0–240 menit.'
      }
      if (!isIntegerIn(form.earlyArrivalLimitMinutes, 0, 480)) {
        return 'Batas datang awal harus 0–480 menit.'
      }
      return null
    }
    case 'window': {
      if (!isIntegerIn(form.bookingWindowDays, 1, 90)) {
        return 'Jendela pemesanan harus 1–90 hari.'
      }
      return null
    }
    case 'approval': {
      if (!isIntegerIn(form.approvalLeadMinutes, 5, 2880)) {
        return 'Tenggat keputusan harus 5–2880 menit.'
      }
      if (!isIntegerIn(form.approvalMinDecisionMinutes, 5, 1440)) {
        return 'Jendela keputusan minimum harus 5–1440 menit.'
      }
      if (!isIntegerIn(form.approvalUrgentBufferMinutes, 0, 14400)) {
        return 'Ambang label mendesak harus 0–14400 menit.'
      }
      return null
    }
  }
}

/**
 * Payload satu seksi. Seluruh field seksi dikirim (bukan hanya yang berubah)
 * karena endpoint-nya sudah idempoten per field dan body yang utuh lebih mudah
 * dibaca di log audit.
 */
export function sectionPayload(
  section: SectionKey,
  form: FormState
): SettingsPayload {
  switch (section) {
    case 'identity':
      return { warehouseName: form.warehouseName.trim() }
    case 'hours':
      return {
        operatingStartMinute: labelToMinute(form.open),
        operatingEndMinute: labelToMinute(form.close),
        slotUnitMinutes: Number(form.slotUnitMinutes),
      }
    case 'arrival':
      return {
        gracePeriodMinutes: Number(form.gracePeriodMinutes),
        earlyArrivalLimitMinutes: Number(form.earlyArrivalLimitMinutes),
      }
    case 'window':
      return { bookingWindowDays: Number(form.bookingWindowDays) }
    case 'approval':
      return {
        approvalMode: form.approvalMode,
        approvalLeadMinutes: Number(form.approvalLeadMinutes),
        approvalMinDecisionMinutes: Number(form.approvalMinDecisionMinutes),
        approvalUrgentBufferMinutes: Number(form.approvalUrgentBufferMinutes),
      }
  }
}

/* --------------------------- turunan tampilan --------------------------- */

/** Nilai ringkas untuk strip dampak. Semuanya dihitung dari draf, bukan server. */
export type Impact = {
  hours: string
  duration: string
  blocks: string
  grace: string
  window: string
  approval: string
}

export function impactOf(form: FormState): Impact {
  const span = minutesBetween(form.open, form.close)
  const unit = Number(form.slotUnitMinutes)

  const blocks =
    span !== null && span > 0 && Number.isInteger(unit) && unit > 0
      ? Math.floor(span / unit)
      : 0

  return {
    hours: form.open && form.close ? `${form.open}–${form.close}` : '—',
    duration: span !== null && span > 0 ? `${roundHours(span)} jam` : '—',
    blocks: blocks > 0 ? `${blocks} blok` : '—',
    grace: form.gracePeriodMinutes ? `${form.gracePeriodMinutes} menit` : '—',
    window: form.bookingWindowDays ? `${form.bookingWindowDays} hari` : '—',
    approval: form.approvalMode === 'AUTO' ? 'Otomatis' : 'Manual',
  }
}

/** 9 jam, 7,5 jam — satu desimal hanya bila memang berpecahan. */
function roundHours(minutes: number) {
  const hours = minutes / 60
  return Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1).replace('.', ',')
}

/**
 * Sisa menit yang tidak masuk blok mana pun. Dikembalikan sebagai peringatan,
 * bukan galat: server tetap menerima rentang seperti ini, tapi admin perlu tahu
 * bahwa ujung jendela operasional tidak bisa dipesan.
 */
export function hoursNote(open: string, close: string, unitValue: string) {
  const span = minutesBetween(open, close)
  const unit = Number(unitValue)
  if (span === null || span <= 0) return null
  if (!Number.isInteger(unit) || unit <= 0) return null
  const remainder = span % unit
  if (remainder === 0) return null
  return `${remainder} menit di ujung jam operasional tidak masuk blok mana pun, jadi tidak bisa dipesan.`
}
