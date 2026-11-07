import { createFileRoute } from '@tanstack/react-router'
import { QueuePage } from '@/features/queue'
import { RequireAuth } from '@/components/require-auth'

export const Route = createFileRoute('/_authenticated/queue')({
  component: () => (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <QueuePage />
    </RequireAuth>
  ),
})
