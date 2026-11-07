import { createFileRoute } from '@tanstack/react-router'
import { MyBookings } from '@/features/bookings'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/bookings/')({
  component: () => (
    <RequireAuth roles={['CUSTOMER']}>
      <MyBookings />
    </RequireAuth>
  ),
})
