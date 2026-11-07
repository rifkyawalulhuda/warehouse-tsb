import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/env'
import { cookieNames, verifyAccessToken, verifyRefreshToken } from '../lib/auth'
import { prisma } from '../lib/prisma'
import type { Role } from '@prisma/client'

let io: Server | null = null

export const rooms = {
  /** Semua petugas: Admin, Checker, Security. */
  staff: 'staff',
  admin: 'admin',
  /** Room pribadi pemilik booking — halaman "Jadwal Saya" / detail booking. */
  user: (userId: string) => `user:${userId}`,
  ticket: (qrToken: string) => `ticket:${qrToken}`,
}

const STAFF_ROLES: Role[] = ['ADMIN', 'CHECKER', 'GATE_OFFICER']

export type RealtimeEvent =
  | { type: 'booking.updated'; bookingId: string; qrToken: string; status: string }
  | { type: 'dock.updated'; dockId: number }
  | { type: 'queue.updated' }

/**
 * Socket.io tidak melewati Express, jadi cookie dibaca langsung dari header
 * handshake. Access token disimpan httpOnly — browser tidak bisa mengirimnya
 * sebagai payload — sehingga ini satu-satunya sumber identitas yang tepercaya.
 * Peran TIDAK pernah diambil dari data kiriman klien.
 */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return undefined
}

/**
 * Identitas untuk keperluan room. Access token berumur 15 menit, jadi bila
 * sudah kedaluwarsa dipakai refresh token (7 hari) lalu peran dibaca dari DB.
 * Tidak ada token yang diperbarui di sini — itu tugas /api/auth/refresh.
 */
async function resolveIdentity(
  cookies: string | undefined
): Promise<{ userId: string; role: Role } | null> {
  const access = readCookie(cookies, cookieNames.access)
  if (access) {
    try {
      const claims = verifyAccessToken(access)
      return { userId: claims.sub, role: claims.role }
    } catch {
      // lanjut ke refresh token
    }
  }

  const refresh = readCookie(cookies, cookieNames.refresh)
  if (!refresh) return null

  try {
    const claims = verifyRefreshToken(refresh)
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, isActive: true },
    })
    if (!user || !user.isActive) return null
    return { userId: user.id, role: user.role }
  } catch {
    return null
  }
}

export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.appOrigin, credentials: true },
  })

  io.on('connection', async (socket) => {
    // Halaman tiket supir tidak punya login; ia bergabung lewat qr_token saja.
    const qrToken = socket.handshake.auth?.qrToken as string | undefined
    if (qrToken) socket.join(rooms.ticket(qrToken))

    const identity = await resolveIdentity(socket.handshake.headers.cookie)
    if (!identity) return

    if (STAFF_ROLES.includes(identity.role)) socket.join(rooms.staff)
    if (identity.role === 'ADMIN') socket.join(rooms.admin)
    socket.join(rooms.user(identity.userId))
  })

  return io
}

export function emitBookingUpdated(payload: {
  bookingId: string
  qrToken: string
  status: string
  userId?: string | null
}) {
  if (!io) return
  const event: RealtimeEvent = {
    type: 'booking.updated',
    bookingId: payload.bookingId,
    qrToken: payload.qrToken,
    status: payload.status,
  }

  io.to(rooms.staff).emit('booking.updated', event)
  io.to(rooms.ticket(payload.qrToken)).emit('booking.updated', event)
  if (payload.userId) io.to(rooms.user(payload.userId)).emit('booking.updated', event)

  // Ping global tanpa isi: klien yang tidak punya room sendiri (mis. daftar
  // "Jadwal Saya") cukup menyegarkan query-nya, tanpa membocorkan data booking
  // milik customer lain.
  io.emit('queue.updated', { type: 'queue.updated' } satisfies RealtimeEvent)
}

export function emitDockUpdated(dockId: number) {
  if (!io) return
  const event: RealtimeEvent = { type: 'dock.updated', dockId }
  io.to(rooms.staff).emit('dock.updated', event)
}

export function closeRealtime() {
  io?.close()
  io = null
}
