import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'

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
 * Pemilih tema berbentuk kartu pratinjau.
 *
 * Perubahan langsung diterapkan tanpa tombol simpan karena sifatnya preferensi
 * peramban (cookie), bukan data server — karena itu seksi ini tidak punya status
 * kotor dan tidak ikut terkirim saat seksi lain disimpan.
 */
export function AppearancePicker() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  return (
    <div className='space-y-3'>
      <div
        role='radiogroup'
        aria-label='Tema tampilan'
        className='grid gap-2.5 sm:grid-cols-3'
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
                'group relative rounded-lg border p-2.5 text-start transition-[border-color,box-shadow,background-color] duration-200 outline-none',
                'hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
                active
                  ? 'border-primary bg-primary/3 shadow-xs'
                  : 'border-border bg-transparent'
              )}
            >
              <span className='mb-2.5 flex h-14 w-full overflow-hidden rounded-md border ring-1 ring-black/5'>
                <span className={cn('h-full w-1/4', option.preview.sidebar)} />
                <span
                  className={cn(
                    'flex h-full flex-1 flex-col gap-1 p-1.5',
                    option.preview.shell
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-2/3 rounded-full',
                      option.preview.bar
                    )}
                  />
                  <span
                    className={cn('h-3 flex-1 rounded', option.preview.card)}
                  />
                </span>
              </span>

              <span className='flex items-center gap-1.5 text-sm font-medium'>
                <Icon className='size-3.5 text-muted-foreground' aria-hidden />
                {option.label}
                <Check
                  className={cn(
                    'ms-auto size-3.5 text-primary transition-opacity duration-150',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                  aria-hidden
                />
              </span>
              <span className='mt-0.5 block text-[11px] leading-snug text-muted-foreground'>
                {option.description}
              </span>
            </button>
          )
        })}
      </div>

      <p className='text-xs text-muted-foreground'>
        Aktif sekarang{' '}
        <span className='font-medium text-foreground'>
          {resolvedTheme === 'dark' ? 'Gelap' : 'Terang'}
        </span>
        {theme === 'system' && ' — mengikuti perangkat'}
      </p>
    </div>
  )
}
