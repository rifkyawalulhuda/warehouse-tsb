import { useId } from 'react'
import { Inbox } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { QueueCard } from './queue-card'
import {
  laneDot,
  oldestWait,
  waitLabel,
  type QueueLane as QueueLaneData,
} from './queue-model'

type CardHandlers = {
  docks?: DockWithBooking[]
  onQuickAssign?: (booking: Booking, dock: DockWithBooking) => void
  onPickDock?: (booking: Booking, dock: DockWithBooking) => void
  onNoShow?: (booking: Booking) => void
  assigning?: boolean
  assignReset?: number
}

/**
 * Kartu satu lane tanpa kotak pembungkus, dipakai dua tempat: di dalam kolom
 * papan (desktop) dan sebagai isi tab (layar sempit). Dipisah supaya kedua
 * tampilan tidak pernah menampilkan isi yang berbeda.
 */
export function QueueCardList({
  lane,
  now,
  columns = 1,
  ...handlers
}: { lane: QueueLaneData; now: Date; columns?: 1 | 2 | 3 } & CardHandlers) {
  if (lane.bookings.length === 0) {
    return (
      <div className='flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-3 py-6 text-center'>
        <Inbox className='size-5 text-muted-foreground/70' aria-hidden />
        <p className='text-xs font-medium text-muted-foreground'>
          {lane.emptyLabel}
        </p>
      </div>
    )
  }

  return (
    <ul
      className={cn(
        'grid gap-3',
        columns === 3 && 'sm:grid-cols-2 xl:grid-cols-3',
        columns === 2 && 'sm:grid-cols-2'
      )}
    >
      {lane.bookings.map((booking) => (
        <li key={booking.id}>
          <QueueCard
            booking={booking}
            laneKey={lane.key}
            now={now}
            {...handlers}
          />
        </li>
      ))}
    </ul>
  )
}

/**
 * Satu kolom papan antrean: judul, hitungan, tunggu terlama, dan kartu truk.
 * Kolom kosong tetap ditampilkan dengan penjelasan, supaya checker tahu kolom
 * itu memang tidak berisi — bukan gagal memuat.
 *
 * "Terlama 42 mnt" di header menjawab pertanyaan yang paling sering muncul saat
 * melihat papan dari jauh tanpa harus membaca tiap kartu.
 */
export function QueueLane({
  lane,
  now,
  columns = 1,
  className,
  ...handlers
}: {
  lane: QueueLaneData
  now: Date
  /** Lebar kartu: 1 untuk kolom papan, 3 saat satu lane ditampilkan penuh. */
  columns?: 1 | 2 | 3
  className?: string
} & CardHandlers) {
  const headingId = useId()
  const oldest = oldestWait(lane, now)

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-muted/30 p-3',
        className
      )}
    >
      <header className='flex flex-col gap-1'>
        <div className='flex items-center justify-between gap-2'>
          <h2
            id={headingId}
            className='flex items-center gap-2 text-sm font-semibold'
          >
            <span
              className={cn('size-2 rounded-full', laneDot[lane.key])}
              aria-hidden
            />
            {lane.title}
          </h2>
          <div className='flex items-center gap-1.5'>
            {oldest && lane.key !== 'atDock' && lane.key !== 'upcoming' && (
              <span className='text-xs text-muted-foreground tabular-nums'>
                terlama {waitLabel(oldest.minutes)}
              </span>
            )}
            <Badge variant='secondary' className='tabular-nums'>
              {lane.bookings.length}
            </Badge>
          </div>
        </div>
        <p className='text-xs text-muted-foreground'>{lane.description}</p>
      </header>

      <QueueCardList lane={lane} now={now} columns={columns} {...handlers} />
    </section>
  )
}
