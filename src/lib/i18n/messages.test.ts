import { describe, expect, it } from 'vitest'
import { id } from './messages/id'
import { en } from './messages/en'

/**
 * Kamus Inggris diketik `Record<MessageKey, string>`, jadi kunci yang hilang
 * sudah ditolak TypeScript. Pengujian ini menjaga hal yang tidak bisa dilihat
 * tipe: kunci berlebih, nilai kosong, dan placeholder `{nama}` yang hilang di
 * salah satu bahasa — penyebab teks berubah jadi "undefined" saat runtime.
 */
const idKeys = Object.keys(id).sort()
const enKeys = Object.keys(en).sort()

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

describe('kamus bahasa', () => {
  it('punya kunci yang sama di kedua bahasa', () => {
    expect(enKeys).toEqual(idKeys)
  })

  it('tidak menyimpan nilai kosong', () => {
    const empty = [...Object.entries(id), ...Object.entries(en)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key)
    expect(empty).toEqual([])
  })

  it('memakai placeholder yang sama di kedua bahasa', () => {
    const mismatched = idKeys.filter((key) => {
      const source = id[key as keyof typeof id]
      const target = en[key as keyof typeof en]
      return placeholders(source).join() !== placeholders(target).join()
    })
    expect(mismatched).toEqual([])
  })
})
