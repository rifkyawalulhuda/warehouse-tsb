import path from 'node:path'
import dotenv from 'dotenv'

// .env ada di root repo. Cari dari cwd lalu satu level di atasnya
// supaya perintah bisa dijalankan dari root maupun dari server/.
for (const candidate of [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
]) {
  if (!candidate) continue
  const result = dotenv.config({ path: candidate, quiet: true })
  if (!result.error) break
}

function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Environment variable ${key} wajib diisi`)
  return value
}

/**
 * Angka opsional dengan batas yang masuk akal.
 *
 * Nilai yang bukan angka tetap jatuh ke bawaan (salah ketik lebih baik tidak
 * menghentikan start), tetapi angka di luar batas ditolak: `PORT=70000` atau
 * TTL nol baru terlihat salah jauh kemudian — saat `listen` gagal atau semua
 * sesi langsung kedaluwarsa — sehingga pesannya tidak lagi menunjuk penyebab.
 */
function optionalNumber(
  key: string,
  fallback: number,
  bounds: { min: number; max: number }
): number {
  const raw = process.env[key]
  if (!raw) return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} harus bilangan bulat, bukan ${raw}`)
  }
  if (parsed < bounds.min || parsed > bounds.max) {
    throw new Error(`${key} harus antara ${bounds.min} dan ${bounds.max}, bukan ${raw}`)
  }
  return parsed
}

/**
 * Rahasia yang menandatangani token.
 *
 * Di produksi nilainya harus panjang dan bukan contoh dari `.env.example`:
 * satu deploy yang lupa mengganti berarti siapa pun yang membaca repositori ini
 * bisa menempa token admin. Pemeriksaan dilakukan saat start agar kegagalan
 * terlihat langsung, bukan setelah ada yang menyalahgunakan token.
 */
const MIN_SECRET_LENGTH = 32

const exampleSecrets = new Set([
  'dev-access-secret-change-me-in-production-0001',
  'dev-refresh-secret-change-me-in-production-0001',
])

const PLACEHOLDER_MARKERS = ['change-me', 'ganti-dengan']

function requiredSecret(key: string): string {
  const value = required(key)
  if (process.env.NODE_ENV !== 'production') return value

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${key} minimal ${MIN_SECRET_LENGTH} karakter di produksi`)
  }
  const placeholder =
    exampleSecrets.has(value) ||
    value.startsWith('dev-') ||
    PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))
  if (placeholder) {
    throw new Error(`${key} masih memakai nilai contoh; ganti dengan rahasia acak`)
  }
  return value
}

const accessSecret = requiredSecret('JWT_ACCESS_SECRET')
const refreshSecret = requiredSecret('JWT_REFRESH_SECRET')

// Satu rahasia untuk dua token berarti kebocoran access token juga membuka
// jalur refresh; memisahkannya sudah jadi tujuan desain, jadi ditegakkan.
if (process.env.NODE_ENV === 'production' && accessSecret === refreshSecret) {
  throw new Error('JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET harus berbeda di produksi')
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: optionalNumber('PORT', 4000, { min: 1, max: 65535 }),
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  /** Umur jejak pemindaian gate sebelum dihapus job pembersih. */
  scanHistoryDays: optionalNumber('SCAN_HISTORY_DAYS', 90, { min: 1, max: 3650 }),
  /**
   * Folder gambar unggahan. Bisa diarahkan keluar folder aplikasi agar tes
   * tidak menghapus berkas yang sedang dipakai proses dev.
   */
  uploadsDir: process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'),
  jwt: {
    accessSecret,
    refreshSecret,
    accessTtlMinutes: optionalNumber('ACCESS_TOKEN_TTL_MINUTES', 15, {
      min: 1,
      max: 1440,
    }),
    refreshTtlDays: optionalNumber('REFRESH_TOKEN_TTL_DAYS', 7, { min: 1, max: 365 }),
  },
}
