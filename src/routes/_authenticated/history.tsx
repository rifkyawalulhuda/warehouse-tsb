import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { GateHistoryPage } from '@/features/history'

export const Route = createFileRoute('/_authenticated/history')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'GATE_OFFICER', 'CHECKER']}>
      <GateHistoryPage />
    </RequireAuth>
  ),
})
