import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createShutdownHandler } from '../src/lib/shutdown'

const open: Server[] = []

afterEach(async () => {
  for (const server of open.splice(0)) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

async function listening(handler: Parameters<typeof createServer>[1]): Promise<{
  server: Server
  url: string
}> {
  const server = createServer(handler)
  open.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${port}` }
}

describe('penutupan server', () => {
  it('menunggu permintaan yang sedang berjalan selesai', async () => {
    const { server, url } = await listening((_req, res) => {
      setTimeout(() => res.end('selesai'), 120)
    })

    const request = fetch(`${url}/lambat`).then((response) => response.text())
    // Beri permintaan waktu masuk sebelum penutupan dimulai.
    await new Promise((resolve) => setTimeout(resolve, 30))

    const result = await createShutdownHandler(server, { timeoutMs: 3000 })('SIGTERM')

    await expect(request).resolves.toBe('selesai')
    expect(result.timedOut).toBe(false)
    expect(server.listening).toBe(false)
  })

  it('memutus permintaan yang melewati batas waktu', async () => {
    const controller = new AbortController()
    const { server, url } = await listening(() => {
      // Sengaja tidak pernah membalas: meniru permintaan yang menggantung.
    })

    const request = fetch(`${url}/menggantung`, { signal: controller.signal }).catch(
      () => null
    )
    await new Promise((resolve) => setTimeout(resolve, 30))

    const result = await createShutdownHandler(server, { timeoutMs: 100 })('SIGTERM')

    expect(result.timedOut).toBe(true)
    expect(server.listening).toBe(false)

    controller.abort()
    await request
  })

  it('sinyal kedua tidak menjalankan pembersihan dua kali', async () => {
    const { server } = await listening((_req, res) => res.end('ok'))
    let stops = 0

    const shutdown = createShutdownHandler(server, {
      timeoutMs: 1000,
      onStop: () => {
        stops += 1
      },
    })

    const [first, second] = await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')])

    expect(stops).toBe(1)
    expect(first.timedOut).toBe(false)
    expect(second.timedOut).toBe(false)
  })
})
