import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket, type BookingUpdatedEvent } from '@/lib/socket'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Mendengarkan perubahan status booking dari server lalu menyegarkan query
 * yang relevan. Tanpa ini setiap layar harus polling.
 */
export function useRealtimeSync(enabled = true) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!enabled || !user) return

    const socket = getSocket()

    const onBookingUpdated = (_event: BookingUpdatedEvent) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      void queryClient.invalidateQueries({ queryKey: ['ticket'] })
      void queryClient.invalidateQueries({ queryKey: ['reports'] })
    }

    const onReconnect = () => {
      void queryClient.invalidateQueries()
    }

    socket.on('booking.updated', onBookingUpdated)
    socket.on('dock.updated', onBookingUpdated)
    socket.on('connect', onReconnect)

    return () => {
      socket.off('booking.updated', onBookingUpdated)
      socket.off('dock.updated', onBookingUpdated)
      socket.off('connect', onReconnect)
    }
  }, [enabled, user, queryClient])
}
