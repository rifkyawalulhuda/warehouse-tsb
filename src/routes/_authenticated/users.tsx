import { createFileRoute } from '@tanstack/react-router'
import { UsersPage } from '@/features/users'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/users')({
  component: () => (
    <RequireAuth roles={['ADMIN']}>
      <UsersPage />
    </RequireAuth>
  ),
})
