import { createServer } from 'node:http'
import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { createShutdownHandler } from './lib/shutdown'
import { closeRealtime, initRealtime } from './realtime'
import { startNoShowJob } from './jobs/no-show'
import { startApprovalExpiryJob } from './jobs/approval-expiry'
import { startScanPruneJob } from './jobs/scan-attempts'
import { startUploadPruneJob } from './jobs/uploads'

async function main() {
  const app = createApp()
  const server = createServer(app)

  initRealtime(server)
  startNoShowJob()
  startApprovalExpiryJob()
  startScanPruneJob()
  startUploadPruneJob()

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${env.port}`)
  })

  // WebSocket dan koneksi database ditutup lebih dulu: keduanya tidak akan
  // selesai sendiri, sedangkan permintaan HTTP yang sedang berjalan diberi
  // waktu sampai batas di `createShutdownHandler`.
  const shutdown = createShutdownHandler(server, {
    onStop: async () => {
      closeRealtime()
      await prisma.$disconnect()
    },
  })

  const stop = (signal: string) => {
    void shutdown(signal).then(() => process.exit(0))
  }

  process.on('SIGINT', () => stop('SIGINT'))
  process.on('SIGTERM', () => stop('SIGTERM'))
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[api] failed to start', error)
  process.exit(1)
})
