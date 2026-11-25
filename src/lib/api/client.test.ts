import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '@/lib/i18n/locale'
import { apiErrorMessage } from './client'

/**
 * `apiErrorMessage` memilih terjemahan dari KODE galat server, bukan dari teks
 * yang dikirim server. Teks server hanya cadangan ketika kodenya belum dikenal.
 */
function httpError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { error: { code, message } } },
  })
}

describe('apiErrorMessage', () => {
  afterEach(() => setLocale('id'))

  it('membedakan login salah dari sesi kedaluwarsa', () => {
    // Ini yang dulu tertukar: login dengan password salah memakai kode
    // UNAUTHORIZED, sehingga orang yang belum pernah masuk diberi tahu
    // sesinya berakhir.
    expect(
      apiErrorMessage(
        httpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah')
      )
    ).toMatch(/kata sandi tidak cocok/i)

    expect(
      apiErrorMessage(
        httpError(401, 'UNAUTHORIZED', 'Sesi tidak valid atau sudah berakhir')
      )
    ).toMatch(/sesi/i)
  })

  it('menerjemahkan batas percobaan login', () => {
    expect(
      apiErrorMessage(
        httpError(
          429,
          'TOO_MANY_ATTEMPTS',
          'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'
        )
      )
    ).toMatch(/15 menit/i)
  })

  it('memakai bahasa aktif', () => {
    setLocale('en')
    expect(
      apiErrorMessage(
        httpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah')
      )
    ).toMatch(/does not match/i)
  })

  it('menyebut koneksi saat server tidak terjangkau', () => {
    const offline = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      response: undefined,
    })
    expect(apiErrorMessage(offline)).toMatch(/koneksi|server/i)
  })
})