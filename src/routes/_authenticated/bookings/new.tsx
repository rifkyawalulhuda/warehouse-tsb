import { createFileRoute } from '@tanstack/react-router'
import { CreateBooking } from '@/features/bookings/create'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/bookings/new')({
  component: () => (
    <RequireAuth roles={['CUSTOMER', 'ADMIN']}>
      <CreateBooking />
    </RequireAuth>
  ),
})
