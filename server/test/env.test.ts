import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `env.ts` memeriksa nilainya saat modul dimuat, jadi satu-satunya cara
 * menguji penolakan adalah mengimpor ulang modul dengan lingkungan berbeda.
 * Nilai yang diisi sebelum impor menang atas `.env` karena dotenv tidak
 * menimpa variabel yang sudah ada.
 */
const KEYS = [
  'NODE_ENV',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
  'ACCESS_TOKEN_TTL_MINUTES',
  'REFRESH_TOKEN_TTL_DAYS',
  'SCAN_HISTORY_DAYS',
] as const

type Key = (typeof KEYS)[number]

const ACCESS = 'access-secret-acak-untuk-tes-0123456789abcdef'
const REFRESH = 'refresh-secret-acak-untuk-tes-0123456789abcdef'

let saved: Record<Key, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]])) as Record<
    Key,
    string | undefined
  >
  vi.resetModules()
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.resetModules()
})

function load(overrides: Partial<Record<Key, string>>) {
  Object.assign(process.env, overrides)
  return import('../src/config/env')
}

describe('konfigurasi produksi', () => {
  it('menolak rahasia yang terlalu pendek', async () => {
    await expect(
      load({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'pendek', JWT_REFRESH_SECRET: REFRESH })
    ).rejects.toThrow(/JWT_ACCESS_SECRET minimal 32 karakter/)
  })

  it('menolak nilai contoh dari .env.example', async () => {
    await expect(
      load({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-in-production-0001',
        JWT_REFRESH_SECRET: REFRESH,
      })
    ).rejects.toThrow(/masih memakai nilai contoh/)
  })

  it('menolak placeholder template produksi', async () => {
    await expect(
      load({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'ganti-dengan-48-byte-acak-untuk-access-token',
        JWT_REFRESH_SECRET: REFRESH,
      })
    ).rejects.toThrow(/masih memakai nilai contoh/)
  })

  it('menolak rahasia access dan refresh yang sama', async () => {
    await expect(
      load({ NODE_ENV: 'production', JWT_ACCESS_SECRET: ACCESS, JWT_REFRESH_SECRET: ACCESS })
    ).rejects.toThrow(/harus berbeda/)
  })

  it('menerima rahasia acak yang memenuhi syarat', async () => {
    const { env } = await load({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: ACCESS,
      JWT_REFRESH_SECRET: REFRESH,
    })

    expect(env.isProduction).toBe(true)
    expect(env.port).toBe(4000)
  })

  it('masih menerima rahasia pendek di luar produksi', async () => {
    const { env } = await load({
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'pendek',
      JWT_REFRESH_SECRET: 'pendek-juga',
    })

    expect(env.jwt.accessSecret).toBe('pendek')
  })
})

describe('angka konfigurasi', () => {
  it('menolak PORT di luar rentang', async () => {
    await expect(
      load({ NODE_ENV: 'test', PORT: '70000', JWT_ACCESS_SECRET: ACCESS, JWT_REFRESH_SECRET: REFRESH })
    ).rejects.toThrow(/PORT harus antara 1 dan 65535/)
  })

  it('memakai bawaan bila PORT bukan angka', async () => {
    const { env } = await load({
      NODE_ENV: 'test',
      PORT: 'bukan-angka',
      JWT_ACCESS_SECRET: ACCESS,
      JWT_REFRESH_SECRET: REFRESH,
    })

    expect(env.port).toBe(4000)
  })

  it('menolak TTL nol karena semua sesi akan langsung kedaluwarsa', async () => {
    await expect(
      load({
        NODE_ENV: 'test',
        ACCESS_TOKEN_TTL_MINUTES: '0',
        JWT_ACCESS_SECRET: ACCESS,
        JWT_REFRESH_SECRET: REFRESH,
      })
    ).rejects.toThrow(/ACCESS_TOKEN_TTL_MINUTES harus antara 1 dan 1440/)
  })
})
