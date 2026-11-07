import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/settings'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/settings')({
  component: () => (
    <RequireAuth roles={['ADMIN']}>
      <SettingsPage />
    </RequireAuth>
  ),
})
