import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/env'
import { verifyAccessToken } from '../lib/auth'
import type { Role } from '@prisma/client'

let io: Server | null = null

export const rooms = {
  admin: 'admin',
  dock: (dockId: number) => `dock:${dockId}`,
  booking: (bookingId: string) => `booking:${bookingId}`,
  ticket: (qrToken: string) => `ticket:${qrToken}`,
}

export type RealtimeEvent =
  | { type: 'booking.updated'; bookingId: string; qrToken: string; status: string }
  | { type: 'dock.updated'; dockId: number }
  | { type: 'queue.updated' }

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.appOrigin, credentials: true },
  })

  io.on('connection', (socket) => {
    const role = socket.handshake.auth?.role as Role | undefined
    const token = socket.handshake.auth?.token as string | undefined

    // Halaman tiket supir tidak punya login; ia bergabung lewat qr_token saja.
    const qrToken = socket.handshake.auth?.qrToken as string | undefined
    if (qrToken) socket.join(rooms.ticket(qrToken))

    if (token) {
      try {
        const claims = verifyAccessToken(token)
        if (claims.role === 'ADMIN') socket.join(rooms.admin)
        if (claims.role === 'CHECKER' || claims.role === 'ADMIN') socket.join(rooms.admin)
        if (role) socket.join(`role:${claims.role}`)
      } catch {
        // token kedaluwarsa: biarkan sebagai tamu (hanya room tiket)
      }
    }
  })

  return io
}

export function emitBookingUpdated(payload: {
  bookingId: string
  qrToken: string
  status: string
  dockId?: number | null
}) {
  if (!io) return
  const event: RealtimeEvent = {
    type: 'booking.updated',
    bookingId: payload.bookingId,
    qrToken: payload.qrToken,
    status: payload.status,
  }
  io.to(rooms.admin).emit('booking.updated', event)
  io.to(rooms.booking(payload.bookingId)).emit('booking.updated', event)
  io.to(rooms.ticket(payload.qrToken)).emit('booking.updated', event)
  io.emit('queue.updated', { type: 'queue.updated' } satisfies RealtimeEvent)
  if (payload.dockId) io.to(rooms.dock(payload.dockId)).emit('booking.updated', event)
}

export function emitDockUpdated(dockId: number) {
  if (!io) return
  io.to(rooms.admin).emit('dock.updated', { type: 'dock.updated', dockId })
  io.to(rooms.dock(dockId)).emit('dock.updated', { type: 'dock.updated', dockId })
}

export function closeRealtime() {
  io?.close()
  io = null
}
