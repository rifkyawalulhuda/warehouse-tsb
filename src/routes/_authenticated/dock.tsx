import { createFileRoute } from '@tanstack/react-router'
import { DockBoard } from '@/features/dock'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/dock')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <DockBoard />
    </RequireAuth>
  ),
})
