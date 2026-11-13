import type { Server } from 'node:http'

const DEFAULT_TIMEOUT_MS = 10_000

export type ShutdownResult = { timedOut: boolean }

/**
 * Penutupan yang menunggu permintaan berjalan selesai.
 *
 * `server.close()` saja tidak cukup: callback-nya baru dipanggil setelah semua
 * koneksi selesai, dan tanpa batas waktu satu permintaan yang menggantung
 * membuat kontainer tidak pernah berhenti — orkestrator lalu mematikannya
 * paksa, tepat pada momen yang ingin dihindari. Di sisi lain, keluar seketika
 * memotong permintaan yang sedang menulis ke database.
 *
 * `onStop` dijalankan lebih dulu untuk memutus hal yang memang tidak akan
 * selesai sendiri (WebSocket, koneksi database), lalu sisa permintaan HTTP
 * diberi waktu `timeoutMs`.
 */
export function createShutdownHandler(
  server: Server,
  options: { timeoutMs?: number; onStop?: () => Promise<void> | void } = {}
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let running: Promise<ShutdownResult> | null = null

  return function shutdown(signal: string): Promise<ShutdownResult> {
    // Sinyal kedua (systemd, `docker stop`, Ctrl+C berulang) tidak boleh
    // memulai penutupan paralel atau menjalankan `onStop` dua kali.
    running ??= (async () => {
      // eslint-disable-next-line no-console
      console.log(`[api] ${signal} received, shutting down`)

      await options.onStop?.()

      const closed = new Promise<void>((resolve) => {
        server.close(() => resolve())
      })

      // Koneksi keep-alive yang menganggur bukan permintaan yang sedang
      // dikerjakan; menahannya hanya memperpanjang penutupan. Diperiksa
      // berulang karena koneksi baru menjadi menganggur tepat setelah
      // permintaan terakhirnya selesai.
      const sweep = setInterval(() => server.closeIdleConnections(), 25)
      sweep.unref()

      let timer: NodeJS.Timeout | undefined
      const expired = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs)
        timer.unref()
      })

      const outcome = await Promise.race([
        closed.then(() => 'closed' as const),
        expired,
      ])
      clearTimeout(timer)
      clearInterval(sweep)

      if (outcome === 'timeout') {
        // eslint-disable-next-line no-console
        console.error(
          `[api] ${timeoutMs} ms habis; permintaan yang belum selesai diputus`
        )
        server.closeAllConnections()
        await closed
      }

      return { timedOut: outcome === 'timeout' }
    })()

    return running
  }
}
