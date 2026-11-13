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

function optionalNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: optionalNumber('PORT', 4000),
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  /** Umur jejak pemindaian gate sebelum dihapus job pembersih. */
  scanHistoryDays: optionalNumber('SCAN_HISTORY_DAYS', 90),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtlMinutes: optionalNumber('ACCESS_TOKEN_TTL_MINUTES', 15),
    refreshTtlDays: optionalNumber('REFRESH_TOKEN_TTL_DAYS', 7),
  },
}
