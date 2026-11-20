import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LOCALES, setLocale, useLocale, useT, type Locale } from '@/lib/i18n'

type LocaleSwitchProps = {
  /** `compact` untuk header, `full` untuk halaman Pengaturan. */
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * Pengalih bahasa. Pilihannya berlaku seketika dan disimpan per perangkat,
 * jadi tidak ada tombol Simpan dan tidak ada permintaan ke server.
 */
export function LocaleSwitch({
  variant = 'compact',
  className,
}: LocaleSwitchProps) {
  const locale = useLocale()
  const t = useT()

  if (variant === 'full') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div
          role='group'
          aria-label={t('locale.switch')}
          className='inline-flex w-fit rounded-lg border bg-muted/40 p-1'
        >
          {LOCALES.map((option) => (
            <button
              key={option.value}
              type='button'
              aria-pressed={locale === option.value}
              onClick={() => setLocale(option.value as Locale)}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium transition-colors',
                locale === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className='text-xs text-muted-foreground'>
          {t('locale.description')}
        </p>
      </div>
    )
  }

  return (
    <div
      role='group'
      aria-label={t('locale.switch')}
      className={cn(
        'inline-flex items-center rounded-lg border bg-muted/40 p-0.5',
        className
      )}
    >
      <Languages
        aria-hidden
        className='mx-1 hidden size-4 text-muted-foreground sm:block'
      />
      {LOCALES.map((option) => (
        <button
          key={option.value}
          type='button'
          aria-pressed={locale === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setLocale(option.value as Locale)}
          className={cn(
            'min-h-8 min-w-11 rounded-md text-xs font-semibold transition-colors',
            locale === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  )
}
