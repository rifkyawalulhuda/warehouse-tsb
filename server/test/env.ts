import path from 'node:path'
import dotenv from 'dotenv'

/**
 * Satu sumber kebenaran untuk URL database tes.
 *
 * Dipakai oleh konfigurasi Vitest maupun global setup. Tes berjalan di atas
 * Postgres sungguhan karena `SELECT ... FOR UPDATE` tidak bisa ditiru mock.
 * URL diarahkan ke database berakhiran `_test` agar data dev/demo aman.
 */
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true })

const baseUrl = process.env.DATABASE_URL
if (!baseUrl) throw new Error('DATABASE_URL belum diset di .env')

function withTestSuffix(url: string): string {
  return url.replace(/\/([^/?]+)(\?|$)/, (_match, name: string, rest: string) =>
    name.endsWith('_test') ? `/${name}${rest}` : `/${name}_test${rest}`
  )
}

export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? withTestSuffix(baseUrl)

const testDbName = new URL(testDatabaseUrl).pathname.replace(/^\//, '')
if (!testDbName.endsWith('_test')) {
  throw new Error(
    `Database tes harus berakhiran _test, bukan "${testDbName}". Periksa TEST_DATABASE_URL di .env.`
  )
}

export const testDatabaseName = testDbName
