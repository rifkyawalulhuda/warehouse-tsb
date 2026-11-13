import { env } from '../config/env'
import { prisma } from '../lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Menghapus jejak pemindaian yang lebih tua dari masa simpan.
 *
 * `scan_attempts` hanya dipakai layar riwayat gate untuk menjelaskan penolakan
 * terakhir, bukan arsip permanen — jejak sebulan lalu tidak pernah dibuka lagi
 * tetapi tetap memperbesar tabel dan indeksnya. Baris di batas persis
 * (`createdAt === cutoff`) dipertahankan; yang dihapus hanya yang lebih tua.
 *
 * Masa simpan diatur `SCAN_HISTORY_DAYS` (bawaan 90 hari).
 */
export async function pruneScanAttempts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.scanHistoryDays * DAY_MS)
  const { count } = await prisma.scanAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return count
}

const INTERVAL_MS = 6 * 60 * 60 * 1000

export function startScanPruneJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const removed = await pruneScanAttempts()
      if (removed > 0) {
        // eslint-disable-next-line no-console
        console.log(`[job] ${removed} jejak pemindaian lama dihapus`)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[job] pemangkasan jejak pemindaian gagal', error)
    }
  }

  void run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return timer
}
