import { cn } from '@/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  laneDot,
  type QueueLane,
  type QueueLaneKey,
} from './queue-model'

export type QueueFilter = QueueLaneKey | 'all'

/**
 * Saringan papan antrean: satu baris chip yang sekaligus menjadi ringkasan hari.
 *
 * Angka di setiap chip adalah jumlah truk di tahap itu, jadi chip ini
 * menggantikan empat kartu statistik yang dulu tidak bisa diklik. Memilih tahap
 * menyaring papan ke tahap itu; "Semua" mengembalikan empat kolom.
 */
export function QueueSummary({
  lanes,
  total,
  value,
  onChange,
  className,
}: {
  lanes: QueueLane[]
  total: number
  value: QueueFilter
  onChange: (value: QueueFilter) => void
  className?: string
}) {
  return (
    <ToggleGroup
      type='single'
      variant='default'
      value={value}
      // Radix mengirim string kosong saat item aktif diklik lagi; papan tidak
      // punya keadaan "tanpa saringan", jadi klik ulang diabaikan.
      onValueChange={(next) => next && onChange(next as QueueFilter)}
      aria-label='Saring papan menurut tahap'
      className={cn('flex w-full flex-wrap gap-2', className)}
    >
      <Chip value='all' label='Semua' count={total} active={value === 'all'} />
      {lanes.map((lane) => (
        <Chip
          key={lane.key}
          value={lane.key}
          label={lane.title}
          count={lane.bookings.length}
          dot={laneDot[lane.key]}
          active={value === lane.key}
        />
      ))}
    </ToggleGroup>
  )
}

function Chip({
  value,
  label,
  count,
  dot,
  active,
}: {
  value: QueueFilter
  label: string
  count: number
  dot?: string
  active: boolean
}) {
  return (
    <ToggleGroupItem
      value={value}
      aria-label={`${label}, ${count} truk`}
      className={cn(
        'h-11 shrink-0 gap-2 rounded-full border border-input bg-card px-4 text-sm font-medium',
        'data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10 data-[state=on]:text-primary',
        count === 0 && 'text-muted-foreground'
      )}
    >
      {dot && <span className={cn('size-2 rounded-full', dot)} aria-hidden />}
      <span>{label}</span>
      <span
        className={cn(
          'rounded-full px-1.5 text-xs tabular-nums',
          active ? 'bg-primary/15' : 'bg-muted'
        )}
        aria-hidden
      >
        {count}
      </span>
    </ToggleGroupItem>
  )
}
