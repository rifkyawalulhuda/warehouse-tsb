import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { ReportsPage } from '@/features/reports'

export const Route = createFileRoute('/_authenticated/reports/')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <ReportsPage />
    </RequireAuth>
  ),
})
