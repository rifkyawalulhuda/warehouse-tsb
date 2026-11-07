import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'

const OPTIONS = [
  {
    value: 'light',
    label: 'Terang',
    description: 'Latar putih, nyaman di ruangan terang.',
    icon: Sun,
    preview: {
      shell: 'bg-white',
      sidebar: 'bg-slate-100',
      bar: 'bg-slate-300',
      card: 'bg-slate-200',
    },
  },
  {
    value: 'dark',
    label: 'Gelap',
    description: 'Latar gelap, mengurangi silau di malam hari.',
    icon: Moon,
    preview: {
      shell: 'bg-slate-900',
      sidebar: 'bg-slate-800',
      bar: 'bg-slate-600',
      card: 'bg-slate-700',
    },
  },
  {
    value: 'system',
    label: 'Ikuti sistem',
    description: 'Menyesuaikan pengaturan perangkat Anda.',
    icon: Monitor,
    preview: {
      shell: 'bg-gradient-to-r from-white to-slate-900',
      sidebar: 'bg-slate-400',
      bar: 'bg-slate-500',
      card: 'bg-slate-300',
    },
  },
] as const

/**
 * Pemilih tema berbentuk kartu pratinjau, dipakai di halaman Pengaturan.
 * Perubahan langsung diterapkan tanpa tombol simpan karena sifatnya preferensi
 * peramban, bukan data server.
 */
export function AppearancePicker() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className='space-y-3'>
      <div
        role='radiogroup'
        aria-label='Tema tampilan'
        className='grid gap-3 sm:grid-cols-3'
      >
        {OPTIONS.map((option) => {
          const Icon = option.icon
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type='button'
              role='radio'
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={cn(
                'group relative rounded-lg border p-3 text-start transition-colors',
                'hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                active ? 'border-primary ring-1 ring-primary' : 'border-border'
              )}
            >
              <span className='mb-3 flex h-16 w-full overflow-hidden rounded-md border'>
                <span className={cn('h-full w-1/4', option.preview.sidebar)} />
                <span className={cn('flex h-full flex-1 flex-col gap-1.5 p-1.5', option.preview.shell)}>
                  <span className={cn('h-1.5 w-2/3 rounded-full', option.preview.bar)} />
                  <span className={cn('h-4 flex-1 rounded', option.preview.card)} />
                </span>
              </span>
              <span className='flex items-center gap-2 text-sm font-medium'>
                <Icon className='size-4' />
                {option.label}
                {active && (
                  <Check className='ms-auto size-4 text-primary' aria-hidden />
                )}
              </span>
              <span className='mt-1 block text-xs text-muted-foreground'>
                {option.description}
              </span>
            </button>
          )
        })}
      </div>

      <p className='text-xs text-muted-foreground'>
        Tema aktif saat ini:{' '}
        <Badge variant='secondary' className='align-middle'>
          {resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}
        </Badge>
        {theme === 'system' && ' (mengikuti perangkat)'}
      </p>
    </div>
  )
}
