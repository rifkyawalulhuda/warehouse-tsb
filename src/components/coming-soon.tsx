import { Telescope } from 'lucide-react'
import { useT } from '@/lib/i18n'

export function ComingSoon() {
  const t = useT()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <Telescope size={72} />
        <h1 className='text-4xl leading-tight font-bold'>
          {t('comingSoon.title')}
        </h1>
        <p className='text-center text-muted-foreground'>
          {t('comingSoon.body')}
        </p>
      </div>
    </div>
  )
}
