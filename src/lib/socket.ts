import { io, type Socket } from 'socket.io-client'
import { refreshSession } from '@/lib/api/client'

let socket: Socket | null = null
let ticketSocket: Socket | null = null
/** Id pengguna yang terakhir melakukan handshake, untuk mendeteksi ganti akun. */
let socketUserId: string | null = null

const URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin

/**
 * Satu koneksi realtime untuk seluruh aplikasi.
 *
 * Identitas tidak dikirim dari klien: server membaca cookie sesi httpOnly dari
 * handshake (`withCredentials`). Access token berumur 15 menit, jadi bila
 * handshake ditolak karena token kedaluwarsa kita segarkan sesi sekali lalu
 * sambung ulang — tanpa itu dashboard akan diam sampai halaman di-reload.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    let refreshing = false
    socket.on('connect_error', async () => {
      if (refreshing) return
      refreshing = true
      try {
        const ok = await refreshSession()
        if (ok) socket?.connect()
      } finally {
        refreshing = false
      }
    })
  }
  return socket
}

/**
 * Menyambung ulang socket sebagai pengguna tertentu.
 *
 * Dipanggil saat identitas berubah. Tanpa ini socket yang sudah tersambung
 * tetap memegang room pengguna LAMA: `socket.connect()` pada socket yang
 * tersambung tidak melakukan apa pun, sedangkan server baru memeriksa ulang
 * identitas tiap 5 menit — jadi di komputer bersama, pengguna baru sempat
 * menerima notifikasi booking milik pengguna sebelumnya.
 *
 * @returns true bila koneksi benar-benar dibuat ulang (identitas berubah).
 */
export function connectSocketAs(userId: string): boolean {
  const socket = getSocket()
  if (socketUserId === userId) {
    if (!socket.connected) socket.connect()
    return false
  }

  socketUserId = userId
  if (socket.connected) socket.disconnect()
  socket.connect()
  return true
}

/**
 * Memutus koneksi dan melupakan identitasnya. Wajib dipanggil saat keluar:
 * kalau tidak, socket pengguna lama tetap hidup dan room-nya tetap berlangganan
 * data miliknya sampai server memutusnya pada pemeriksaan 5 menit berikutnya.
 */
export function closeSocket() {
  socketUserId = null
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}

/**
 * Koneksi terpisah untuk halaman tiket supir yang tidak punya login. Hanya
 * bergabung ke room tiket itu sendiri, jadi tidak butuh cookie sesi.
 */
export function getTicketSocket(qrToken: string): Socket {
  ticketSocket?.close()
  ticketSocket = io(URL, {
    auth: { qrToken },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })
  return ticketSocket
}

export function closeTicketSocket() {
  ticketSocket?.close()
  ticketSocket = null
}

export type BookingUpdatedEvent = {
  bookingId: string
  qrToken: string
  status: string
  dockId?: number | null
}

export type DockUpdatedEvent = { dockId: number }
