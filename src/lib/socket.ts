import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

/**
 * Satu koneksi realtime untuk seluruh aplikasi. Cookie sesi ikut terkirim
 * sehingga server tahu peran pengguna dan room mana yang boleh diikuti.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? window.location.origin, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return socket
}

export type BookingUpdatedEvent = {
  bookingId: string
  qrToken: string
  status: string
  dockId?: number | null
}

export type DockUpdatedEvent = { dockId: number }
