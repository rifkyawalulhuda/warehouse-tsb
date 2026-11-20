import { AlertCircle, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api/client'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function LoadingBlock({ label }: { label?: string }) {
  const t = useT()

  return (
    <div className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
      <Loader2 className='size-4 animate-spin' />
      {label ?? t('common.loadingData')}
    </div>
  )
}

export function ErrorBlock({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const t = useT()

  return (
    <div className='flex flex-col items-center gap-3 py-10 text-center'>
      <AlertCircle className='size-6 text-destructive' />
      <p className='text-sm text-muted-foreground'>{apiErrorMessage(error)}</p>
      {onRetry && (
        <Button variant='outline' size='sm' onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <div className='py-10 text-center text-sm text-muted-foreground'>
      {message}
    </div>
  )
}
