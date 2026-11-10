import { CalendarClock, LayoutGrid, LayoutList, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { BOOKING_FILTERS, type BookingFilter, type BookingsView } from '../booking-view'

const VIEW_OPTIONS: { value: BookingsView; label: string; icon: LucideIcon }[] = [
  { value: 'grid', label: 'Kotak', icon: LayoutGrid },
  { value: 'list', label: 'Daftar', icon: LayoutList },
  { value: 'schedule', label: 'Jadwal', icon: CalendarClock },
]

/**
 * Pemilih tampilan. Desktop memakai segmented control; di layar kecil tombol
 * berlabel ikut menyusut jadi ikon saja agar tidak memakan lebar baris filter,
 * dan `aria-pressed` tetap memberi tahu pembaca layar pilihan yang aktif.
 */
export function ViewSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: BookingsView
  onChange: (view: BookingsView) => void
  disabled?: boolean
}) {
  return (
    <div
      role='group'
      aria-label='Tampilan daftar booking'
      className='inline-flex shrink-0 items-center gap-1 rounded-lg border bg-muted/40 p-1'
    >
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                type='button'
                aria-pressed={active}
                aria-label={`Tampilan ${option.label.toLowerCase()}`}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cn(
                  'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-[background-color,color,box-shadow] duration-200',
                  'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className='size-4' aria-hidden />
                <span className='hidden sm:inline'>{option.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent className='sm:hidden'>Tampilan {option.label.toLowerCase()}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

/**
 * Filter cepat berbentuk chip dengan jumlah. Angka nol tetap ditampilkan agar
 * posisi chip tidak bergeser saat data berubah — chip bertanda nol cukup
 * dinonaktifkan.
 */
export function FilterChips({
  value,
  counts,
  onChange,
  only,
}: {
  value: BookingFilter
  counts: Record<BookingFilter, number>
  onChange: (filter: BookingFilter) => void
  /** Batasi chip yang ditampilkan; filter yang tidak relevan disembunyikan. */
  only?: BookingFilter[]
}) {
  const items = only
    ? BOOKING_FILTERS.filter((filter) => only.includes(filter.value))
    : BOOKING_FILTERS

  return (
    <div
      role='group'
      aria-label='Filter booking'
      className='-mx-1 flex min-w-0 items-center gap-1.5 overflow-x-auto px-1 py-0.5 no-scrollbar'
    >
      {items.map((filter) => {
        const active = value === filter.value
        const count = counts[filter.value]
        return (
          <button
            key={filter.value}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200',
              'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
              active
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {filter.label}
            <Badge
              variant={active ? 'default' : 'secondary'}
              className='h-4 min-w-4 px-1 text-[10px] leading-none tabular-nums'
            >
              {count}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}

