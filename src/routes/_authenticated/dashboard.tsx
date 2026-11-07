import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: () => (
    <RequireAuth roles={['ADMIN']}>
      <Dashboard />
    </RequireAuth>
  ),
})
