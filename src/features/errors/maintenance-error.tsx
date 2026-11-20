import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function MaintenanceError() {
  const t = useT()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('errors.maintenance')}</span>
        <p className='max-w-md text-center text-muted-foreground'>
          {t('errors.maintenanceBody')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline'>{t('common.learnMore')}</Button>
        </div>
      </div>
    </div>
  )
}
