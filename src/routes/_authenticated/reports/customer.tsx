import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { CustomerReportsPage } from '@/features/reports/customer'

export const Route = createFileRoute('/_authenticated/reports/customer')({
  component: () => (
    <RequireAuth roles={['CUSTOMER']}>
      <CustomerReportsPage />
    </RequireAuth>
  ),
})
