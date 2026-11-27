import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { closeSocket, connectSocketAs, getSocket } from '@/lib/socket'

/**
 * Mendengarkan perubahan dari server lalu menyegarkan query yang relevan.
 * Tanpa ini setiap layar harus polling.
 *
 * Identitas dikirim lewat cookie sesi saat handshake, jadi socket yang dibuat
 * sebelum login tidak akan pernah masuk room petugas. `connectSocketAs`
 * menyambung ulang HANYA saat pengguna berganti — dulu efek ini memutus lalu
 * menyambung setiap kali hook dipasang, dan karena hampir setiap halaman
 * memakainya, pindah menu berulang kali menjatuhkan koneksi dan kehilangan
 * event di sela-selanya.
 */
export function useRealtimeSync(enabled = true) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!enabled || !userId) {
      // Sesi berakhir (refresh ditolak) atau pengguna keluar: koneksi yang masih
      // hidup akan terus berada di room pengguna lama.
      closeSocket()
      return
    }

    connectSocketAs(userId)
    const socket = getSocket()

    const onBooking = () => {
      // Perubahan booking hanya menyentuh jadwal dan layar operasional. Laporan,
      // master, dan tiket tidak ikut disegarkan: dulu satu scan memicu enam
      // keluarga query di SETIAP tab staf, dan sebagian besarnya tidak berubah.
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
    }

    const onDock = () => {
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      void queryClient.invalidateQueries({ queryKey: ['master'] })
    }

    // Ping global tanpa isi untuk klien yang tidak punya room sendiri (mis.
    // "Jadwal Saya"): cukup daftar booking, bukan seluruh aplikasi.
    const onQueue = () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
    }

    const onConnect = () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
    }

    socket.on('booking.updated', onBooking)
    socket.on('dock.updated', onDock)
    socket.on('queue.updated', onQueue)
    socket.on('connect', onConnect)

    return () => {
      socket.off('booking.updated', onBooking)
      socket.off('dock.updated', onDock)
      socket.off('queue.updated', onQueue)
      socket.off('connect', onConnect)
    }
  }, [enabled, userId, queryClient])
}
