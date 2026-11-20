import { useEffect } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT, type MessageKey } from '@/lib/i18n'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const THEME_OPTIONS: {
  value: 'light' | 'dark' | 'system'
  label: MessageKey
  icon: typeof Sun
}[] = [
  { value: 'light', label: 'theme.light', icon: Sun },
  { value: 'dark', label: 'theme.dark', icon: Moon },
  { value: 'system', label: 'theme.system', icon: Monitor },
]

export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const t = useT()

  /* Warna bilah peramban mengikuti tema yang benar-benar tampil, bukan nilai
   * mentah `theme`, supaya mode "Ikuti sistem" tidak salah warna. */
  useEffect(() => {
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    metaThemeColor?.setAttribute(
      'content',
      resolvedTheme === 'dark' ? '#020817' : '#ffffff'
    )
  }, [resolvedTheme])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn('scale-95 rounded-full', className)}
          aria-label={t('theme.switchLabel')}
        >
          <Sun className='size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90' />
          <Moon className='absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0' />
          <span className='sr-only'>{t('theme.switchLabel')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-44'>
        <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
          {t('theme.label')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon />
            {t(label)}
            <Check
              size={14}
              className={cn('ms-auto', theme !== value && 'hidden')}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
