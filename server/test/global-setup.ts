import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { testDatabaseName, testDatabaseUrl } from './env'

/**
 * Menyiapkan database tes sekali per run:
 * 1. membuat database `<nama>_test` bila belum ada,
 * 2. menerapkan migrasi ke database tersebut.
 *
 * Database dev tidak pernah tersentuh karena URL-nya berbeda dan nama database
 * wajib berakhiran `_test` (dijaga di test/env.ts).
 */
export default async function setup() {
  // Koneksi ke database pemeliharaan untuk membuat database tes.
  const adminUrl = new URL(testDatabaseUrl)
  adminUrl.pathname = '/postgres'

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } })
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${testDatabaseName}"`)
  } catch (error) {
    // Prisma membungkus SQLSTATE di `meta.code` (P2010); `code` berisi P2010,
    // jadi keduanya harus diperiksa, bukan memakai `??`.
    const codes = new Set([
      (error as { code?: string }).code,
      (error as { meta?: { code?: string } }).meta?.code,
    ])
    // 42P04 = duplicate_database; database sudah ada, aman dilanjutkan.
    if (!codes.has('42P04')) throw error
  } finally {
    await admin.$disconnect()
  }

  const prismaCli = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js')
  execFileSync(
    process.execPath,
    [
      prismaCli,
      'migrate',
      'deploy',
      '--schema',
      path.resolve(process.cwd(), 'server/prisma/schema.prisma'),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    }
  )
}
