import { createFileRoute } from '@tanstack/react-router'
import { BookingDetail } from '@/features/bookings/detail'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/bookings/$bookingId')({
  component: () => (
    <RequireAuth roles={['CUSTOMER', 'ADMIN']}>
      <BookingDetail />
    </RequireAuth>
  ),
})
