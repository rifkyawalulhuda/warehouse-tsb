import { id, type MessageKey } from './messages/id'
import { en } from './messages/en'
import type { Locale } from './locale'

export type { MessageKey }
export type Vars = Record<string, string | number>

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { id, en }

/**
 * Terjemahan dengan interpolasi `{nama}`.
 *
 * Kunci yang belum diterjemahkan jatuh ke bahasa Indonesia lalu ke kunci itu
 * sendiri, jadi layar tidak pernah kosong karena terjemahan terlewat.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Vars
): string {
  const template = DICTIONARIES[locale]?.[key] ?? id[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole
  )
}

/** Apakah kode error dari server punya terjemahan sendiri. */
export function hasMessage(key: string): key is MessageKey {
  return key in id
}
