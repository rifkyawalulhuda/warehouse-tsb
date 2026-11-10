import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { CheckerScanPage } from '@/features/checker-scan'

export const Route = createFileRoute('/_authenticated/checker/scan')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <CheckerScanPage />
    </RequireAuth>
  ),
})
