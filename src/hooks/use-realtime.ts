import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Mendengarkan perubahan dari server lalu menyegarkan query yang relevan.
 * Tanpa ini setiap layar harus polling.
 *
 * Identitas dikirim lewat cookie sesi saat handshake, jadi socket yang dibuat
 * sebelum login tidak akan pernah masuk room petugas. Efek ini menyambung
 * ulang setiap kali pengguna berganti supaya handshake membawa cookie terbaru.
 */
export function useRealtimeSync(enabled = true) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!enabled || !userId) return

    const socket = getSocket()

    const refreshAll = () => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      void queryClient.invalidateQueries({ queryKey: ['ticket'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
      void queryClient.invalidateQueries({ queryKey: ['master'] })
      // Antrean persetujuan punya kunci sendiri. Tanpa baris ini keputusan
      // Admin lain tidak terlihat sampai halaman dimuat ulang — dan penanda
      // jumlah di menu ikut tertinggal.
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
    }

    const onConnect = () => refreshAll()

    socket.on('booking.updated', refreshAll)
    socket.on('dock.updated', refreshAll)
    // Ping global tanpa isi: dipakai halaman yang tidak punya room sendiri.
    socket.on('queue.updated', refreshAll)
    socket.on('connect', onConnect)

    // Handshake ulang dengan cookie sesi yang sekarang. `connect()` pada socket
    // yang sudah tersambung tidak melakukan apa pun, jadi putuskan lebih dulu.
    if (socket.connected) socket.disconnect()
    socket.connect()

    return () => {
      socket.off('booking.updated', refreshAll)
      socket.off('dock.updated', refreshAll)
      socket.off('queue.updated', refreshAll)
      socket.off('connect', onConnect)
    }
  }, [enabled, userId, queryClient])
}
