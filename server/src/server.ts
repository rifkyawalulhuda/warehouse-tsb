import { createServer } from 'node:http'
import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { initRealtime } from './realtime'
import { startNoShowJob } from './jobs/no-show'
import { startApprovalExpiryJob } from './jobs/approval-expiry'
import { startScanPruneJob } from './jobs/scan-attempts'

async function main() {
  const app = createApp()
  const server = createServer(app)

  initRealtime(server)
  startNoShowJob()
  startApprovalExpiryJob()
  startScanPruneJob()

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on http://localhost:${env.port}`)
  })

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} received, shutting down`)
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[api] failed to start', error)
  process.exit(1)
})
