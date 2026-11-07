import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/reports'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/reports')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <ReportsPage />
    </RequireAuth>
  ),
})
