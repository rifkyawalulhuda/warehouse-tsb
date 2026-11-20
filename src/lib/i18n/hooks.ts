import { useCallback, useSyncExternalStore } from 'react'
import {
  getLocale,
  subscribeLocale,
  type Locale,
} from './locale'
import { translate, type MessageKey, type Vars } from './translate'

/** Bahasa aktif; komponen yang memakainya ikut digambar ulang saat diganti. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale)
}

/**
 * Fungsi terjemahan untuk komponen.
 *
 * Pemakaian: `const t = useT()` lalu `t('bookings.title')`. Nilai variabel
 * ditulis `{nama}` di kamus.
 */
export function useT() {
  const locale = useLocale()
  return useCallback(
    (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    [locale]
  )
}
