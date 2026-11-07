import { createFileRoute } from '@tanstack/react-router'
import { ScanPage } from '@/features/scanner'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/scan')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'GATE_OFFICER']}>
      <ScanPage />
    </RequireAuth>
  ),
})
