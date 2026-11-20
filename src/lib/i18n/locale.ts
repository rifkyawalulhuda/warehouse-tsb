/**
 * Bahasa antarmuka.
 *
 * Pilihan disimpan per perangkat (localStorage), bukan per akun, jadi satu
 * pengguna bisa memakai bahasa berbeda di ponsel dan desktop tanpa perubahan
 * skema database. Store-nya module-level supaya kode non-React — formatter
 * tanggal, penggambar kanvas tiket — bisa membaca bahasa aktif tanpa hook.
 */

export type Locale = 'id' | 'en'

export const LOCALES: { value: Locale; label: string; short: string }[] = [
  { value: 'id', label: 'Bahasa Indonesia', short: 'IND' },
  { value: 'en', label: 'English', short: 'ENG' },
]

/** Locale Intl per bahasa. `en-GB` dipilih agar urutan tanggal tetap hari-bulan. */
export const INTL_LOCALE: Record<Locale, string> = {
  id: 'id-ID',
  en: 'en-GB',
}

const STORAGE_KEY = 'tsb.locale'

function isLocale(value: unknown): value is Locale {
  return value === 'id' || value === 'en'
}

function readStored(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // localStorage bisa dilarang (mode privat, iframe ketat).
  }
  return 'id'
}

let current: Locale = typeof window === 'undefined' ? 'id' : readStored()

const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

export function localeToIntl(locale: Locale = current): string {
  return INTL_LOCALE[locale]
}

function applyDocumentLang(locale: Locale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

export function setLocale(next: Locale): void {
  if (next === current) return
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Abaikan: pilihan tetap berlaku sampai halaman ditutup.
  }
  applyDocumentLang(next)
  for (const listener of listeners) listener()
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Dipanggil sekali saat aplikasi dimuat agar atribut `lang` ikut tersimpan. */
export function initLocale(): Locale {
  applyDocumentLang(current)
  return current
}
