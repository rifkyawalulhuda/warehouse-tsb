import { createFileRoute } from '@tanstack/react-router'
import { MasterData } from '@/features/master'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/master')({
  component: () => (
    <RequireAuth roles={['ADMIN']}>
      <MasterData />
    </RequireAuth>
  ),
})
