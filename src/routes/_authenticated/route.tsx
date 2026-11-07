import { createFileRoute } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated')({
  component: () => (
    <RequireAuth>
      <AuthenticatedLayout />
    </RequireAuth>
  ),
})
