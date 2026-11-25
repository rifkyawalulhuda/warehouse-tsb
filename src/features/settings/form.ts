import type { Settings, TicketDesign } from '@/lib/api/types'
import { labelToMinute } from '@/lib/format'
import { localeToIntl, type MessageKey, type Vars } from '@/lib/i18n'

/** Bentuk fungsi terjemahan yang diterima fungsi murni di berkas ini. */
export type Translate = (key: MessageKey, vars?: Vars) => string

/**
 * Bentuk state form Pengaturan. Angka disimpan sebagai string karena input
 * angka yang dikosongkan bernilai `''`, bukan `0` — menyimpannya sebagai number
 * akan membuat field kosong diam-diam tersimpan sebagai nol.
 */
export type FormState = {
  warehouseName: string
  appName: string
  appTagline: string
  appShortName: string
  /** Logo aplikasi; kosong = lencana huruf pertama nama aplikasi. */
  appLogoUrl: string
  /** Paragraf sambutan halaman masuk; kosong = teks bawaan. */
  loginDescription: string
  /** URL gambar sisi kanan halaman masuk; kosong = gradien bawaan. */
  loginCoverUrl: string
  /** Warna aksen halaman masuk, hex; kosong = warna bawaan tema. */
  loginBrandColor: string
  /** Baris pertama footer; kosong = teks bawaan sesuai bahasa aktif. */
  footerCompany: string
  /** Baris kedua footer (lokasi · shift); kosong = teks bawaan. */
  footerLocation: string
  /** Tampilkan baris lokasi di footer; false = baris dan pemisahnya hilang. */
  footerShowLocation: boolean
  /** Tata letak kartu tiket supir; satu pilihan untuk semua tiket. */
  ticketDesign: TicketDesign
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
  | 'identity'
  | 'brand'
  | 'login'
  | 'hours'
  | 'arrival'
  | 'window'
  | 'approval'
  | 'ticket'

export const FIELD_GROUPS = {
  identity: ['warehouseName'],
  // Merek menjawab "aplikasi ini siapa": logo, judul, subjudul, nama pendek.
  brand: [
    'appLogoUrl',
    'appName',
    'appTagline',
    'appShortName',
    'footerCompany',
    'footerLocation',
    'footerShowLocation',
  ],
  // Halaman masuk menjawab "apa yang dilihat orang pertama kali".
  login: ['loginDescription', 'loginCoverUrl', 'loginBrandColor'],
  hours: ['open', 'close', 'slotUnitMinutes'],
  arrival: ['gracePeriodMinutes', 'earlyArrivalLimitMinutes'],
  window: ['bookingWindowDays'],
  approval: [
    'approvalMode',
    'approvalLeadMinutes',
    'approvalMinDecisionMinutes',
    'approvalUrgentBufferMinutes',
  ],
  // Tata letak tiket dipilih Admin; nilainya bukan teks bebas, jadi tidak ada
  // validasi isian — hanya pilihan tertutup dari delapan desain.
  ticket: ['ticketDesign'],
} as const satisfies Record<SectionKey, readonly (keyof FormState)[]>

export const SECTION_KEYS = Object.keys(FIELD_GROUPS) as SectionKey[]

export const ALL_FIELDS = SECTION_KEYS.flatMap(
  (section) => FIELD_GROUPS[section] as readonly (keyof FormState)[]
)

export type SettingsPayload = {
  warehouseName?: string
  appName?: string
  appTagline?: string
  appShortName?: string | null
  appLogoUrl?: string | null
  loginDescription?: string | null
  loginCoverUrl?: string | null
  loginBrandColor?: string | null
  footerCompany?: string | null
  footerLocation?: string | null
  footerShowLocation?: boolean
  ticketDesign?: TicketDesign
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
    appName: settings.appName,
    appTagline: settings.appTagline,
    appShortName: settings.appShortName ?? '',
    appLogoUrl: settings.appLogoUrl ?? '',
    loginDescription: settings.loginDescription ?? '',
    loginCoverUrl: settings.loginCoverUrl ?? '',
    loginBrandColor: settings.loginBrandColor ?? '',
    footerCompany: settings.footerCompany ?? '',
    footerLocation: settings.footerLocation ?? '',
    footerShowLocation: settings.footerShowLocation,
    ticketDesign: settings.ticketDesign,
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
    case 'brand':
      return {
        ...current,
        appLogoUrl: saved.appLogoUrl,
        appName: saved.appName,
        appTagline: saved.appTagline,
        appShortName: saved.appShortName,
        footerCompany: saved.footerCompany,
        footerLocation: saved.footerLocation,
        footerShowLocation: saved.footerShowLocation,
      }
    case 'login':
      return {
        ...current,
        loginDescription: saved.loginDescription,
        loginCoverUrl: saved.loginCoverUrl,
        loginBrandColor: saved.loginBrandColor,
      }
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
    case 'ticket':
      return { ...current, ticketDesign: saved.ticketDesign }
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

/**
 * Batas paragraf sambutan. Angka ini sama dengan lebar kolom
 * `login_description` di database dan dengan batas di skema Zod server; kalau
 * salah satunya diubah, yang lain harus ikut.
 */
export const LOGIN_DESCRIPTION_MAX = 240

/** Angka bulat dalam rentang; string kosong selalu ditolak, termasuk untuk min 0. */
function isIntegerIn(value: string, min: number, max: number) {
  const trimmed = value.trim()
  if (trimmed === '') return false
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

/** #RRGGBB saja: nilai ini dipakai sebagai variabel CSS di halaman masuk. */
export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/**
 * Gambar hanya boleh berasal dari unggahan sendiri (`/api/uploads/…`) atau
 * https. Alamat `javascript:` atau `data:` di properti CSS latar akan lolos
 * dari pemeriksaan biasa, jadi ditolak di sini dan juga di server.
 */
export function isSafeImageUrl(value: string) {
  return value.startsWith('/api/uploads/') || /^https:\/\//i.test(value)
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
  form: FormState,
  t: Translate
): string | null {
  switch (section) {
    case 'identity': {
      const name = form.warehouseName.trim()
      if (name.length < 2) return t('settings.error.warehouseMin')
      if (name.length > 120) return t('settings.error.warehouseMax')
      return null
    }
    case 'brand': {
      const appName = form.appName.trim()
      // Nama kosong akan membuat header dan judul tab tampak rusak, jadi
      // ditolak di sini — bukan diam-diam diganti nilai bawaan.
      if (appName.length === 0) return t('settings.error.appNameRequired')
      if (appName.length > 60) return t('settings.error.appNameMax')
      if (form.appTagline.trim().length > 80) {
        return t('settings.error.taglineMax')
      }
      if (form.appShortName.trim().length > 20) {
        return t('settings.error.shortNameMax')
      }
      // Batas ini sama dengan lebar kolom database dan skema Zod server.
      if (form.footerCompany.trim().length > 200) {
        return t('settings.error.footerCompanyMax')
      }
      if (form.footerLocation.trim().length > 120) {
        return t('settings.error.footerLocationMax')
      }
      const logo = form.appLogoUrl.trim()
      if (logo !== '' && !isSafeImageUrl(logo)) {
        return t('settings.error.logo')
      }
      return null
    }
    case 'login': {
      if (form.loginDescription.trim().length > LOGIN_DESCRIPTION_MAX) {
        return t('settings.error.loginMax', { max: LOGIN_DESCRIPTION_MAX })
      }
      const cover = form.loginCoverUrl.trim()
      if (cover !== '' && !isSafeImageUrl(cover)) {
        return t('settings.error.image')
      }
      const color = form.loginBrandColor.trim()
      if (color !== '' && !isHexColor(color)) {
        return t('settings.error.color')
      }
      return null
    }
    case 'hours': {
      if (!isIntegerIn(form.slotUnitMinutes, 15, 120)) {
        return t('settings.error.unitRange')
      }
      const span = minutesBetween(form.open, form.close)
      if (span === null) return t('settings.error.hoursRequired')
      if (span <= 0) return t('settings.error.hoursOrder')
      const unit = Number(form.slotUnitMinutes)
      if (span % unit !== 0) {
        return t('settings.error.unitRemainder', { span, unit })
      }
      return null
    }
    case 'arrival': {
      if (!isIntegerIn(form.gracePeriodMinutes, 0, 240)) {
        return t('settings.error.graceRange')
      }
      if (!isIntegerIn(form.earlyArrivalLimitMinutes, 0, 480)) {
        return t('settings.error.earlyRange')
      }
      return null
    }
    case 'window': {
      if (!isIntegerIn(form.bookingWindowDays, 1, 90)) {
        return t('settings.error.windowRange')
      }
      return null
    }
    case 'approval': {
      if (!isIntegerIn(form.approvalLeadMinutes, 5, 2880)) {
        return t('settings.error.leadRange')
      }
      if (!isIntegerIn(form.approvalMinDecisionMinutes, 5, 1440)) {
        return t('settings.error.minDecisionRange')
      }
      if (!isIntegerIn(form.approvalUrgentBufferMinutes, 0, 14400)) {
        return t('settings.error.urgentRange')
      }
      return null
    }
    case 'ticket':
      // Pilihannya tertutup (delapan radio), jadi tidak ada isian yang bisa salah.
      return null
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
    case 'brand':
      return {
        appName: form.appName.trim(),
        appTagline: form.appTagline.trim(),
        // String kosong dikirim sebagai null: server lalu memakai judul penuh
        // untuk tab, bukan nama pendek sepanjang nol karakter.
        appShortName: form.appShortName.trim() || null,
        appLogoUrl: form.appLogoUrl.trim() || null,
        // Kosong berarti "pakai teks bawaan", yang berbeda per bahasa.
        footerCompany: form.footerCompany.trim() || null,
        footerLocation: form.footerLocation.trim() || null,
        footerShowLocation: form.footerShowLocation,
      }
    case 'login':
      return {
        loginDescription: form.loginDescription.trim() || null,
        loginCoverUrl: form.loginCoverUrl.trim() || null,
        loginBrandColor: form.loginBrandColor.trim() || null,
      }
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
    case 'ticket':
      return { ticketDesign: form.ticketDesign }
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

export function impactOf(form: FormState, t: Translate): Impact {
  const span = minutesBetween(form.open, form.close)
  const unit = Number(form.slotUnitMinutes)

  const blocks =
    span !== null && span > 0 && Number.isInteger(unit) && unit > 0
      ? Math.floor(span / unit)
      : 0

  return {
    hours: form.open && form.close ? `${form.open}–${form.close}` : '—',
    duration:
      span !== null && span > 0
        ? t('duration.hours', { count: roundHours(span) })
        : '—',
    blocks: blocks > 0 ? t('settings.impact.blocks', { count: blocks }) : '—',
    grace: form.gracePeriodMinutes
      ? t('duration.minutes', { count: form.gracePeriodMinutes })
      : '—',
    window: form.bookingWindowDays
      ? t('settings.window.daysUnit', { count: form.bookingWindowDays })
      : '—',
    approval:
      form.approvalMode === 'AUTO'
        ? t('settings.approval.auto')
        : t('settings.approval.manual'),
  }
}

/** 9 jam, 7,5 jam — satu desimal hanya bila memang berpecahan. */
function roundHours(minutes: number) {
  const hours = minutes / 60
  return Number.isInteger(hours)
    ? String(hours)
    : new Intl.NumberFormat(localeToIntl(), {
        maximumFractionDigits: 1,
      }).format(hours)
}

/**
 * Sisa menit yang tidak masuk blok mana pun. Dikembalikan sebagai peringatan,
 * bukan galat: server tetap menerima rentang seperti ini, tapi admin perlu tahu
 * bahwa ujung jendela operasional tidak bisa dipesan.
 */
export function hoursNote(
  open: string,
  close: string,
  unitValue: string,
  t: Translate
) {
  const span = minutesBetween(open, close)
  const unit = Number(unitValue)
  if (span === null || span <= 0) return null
  if (!Number.isInteger(unit) || unit <= 0) return null
  const remainder = span % unit
  if (remainder === 0) return null
  return t('settings.note.hours', { minutes: remainder })
}
