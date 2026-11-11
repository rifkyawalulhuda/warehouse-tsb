import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Clock,
  PlayCircle,
  Truck,
  Warehouse,
} from 'lucide-react'
import type { Booking, DockWithBooking, QueueResponse } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { dockFilterCounts, waitingCount } from './dock-model'

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  emphasis,
}: {
  icon: typeof Truck
  label: string
  value: number
  hint: string
  emphasis?: boolean
}) {
  return (
    <Card className={cn('gap-0 py-0', emphasis && 'border-violet-300/80')}>
      <div className='flex items-start gap-3 p-3 sm:p-4'>
        <span className='hidden rounded-lg bg-muted p-2 text-muted-foreground sm:inline-flex'>
          <Icon className='size-4' aria-hidden />
        </span>
        <div className='min-w-0 space-y-0.5'>
          <p className='text-xs text-muted-foreground'>{label}</p>
          <p
            className={cn(
              'text-xl font-semibold leading-none tabular-nums sm:text-2xl',
              emphasis && 'text-violet-700 dark:text-violet-300'
            )}
          >
            {value}
          </p>
          <p className='text-xs text-muted-foreground'>{hint}</p>
        </div>
      </div>
    </Card>
  )
}

export function DockSummary({
  docks,
  waiting,
}: {
  docks: DockWithBooking[]
  waiting: number
}) {
  const counts = dockFilterCounts(docks)
  const maintenanceHint =
    counts.maintenance > 0 ? `${counts.maintenance} dalam perawatan` : 'Siap menerima truk'

  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
      <SummaryTile
        icon={Truck}
        label='Sedang diproses'
        value={counts.serving}
        hint={`dari ${counts.all} dock`}
      />
      <SummaryTile
        icon={PlayCircle}
        label='Perlu dimulai'
        value={counts.action}
        hint={counts.action > 0 ? 'Truk menunggu tombol mulai' : 'Tidak ada yang menunggu'}
        emphasis={counts.action > 0}
      />
      <SummaryTile
        icon={Warehouse}
        label='Dock kosong'
        value={counts.empty}
        hint={maintenanceHint}
      />
      <SummaryTile
        icon={Clock}
        label='Antrean hari ini'
        value={waiting}
        hint='Truk menunggu di gerbang'
      />
    </div>
  )
}

function QueueChip({ booking }: { booking: Booking }) {
  return (
    <span className='inline-flex min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5'>
      <span className='truncate font-mono text-xs font-medium'>
        {booking.bookingCode}
      </span>
      <span className='max-w-24 truncate text-xs text-muted-foreground'>
        {booking.licensePlate ?? 'tanpa plat'}
      </span>
      {booking.lateMinutes > 0 && (
        <Badge
          variant='outline'
          className='border-orange-300/70 text-orange-700 dark:border-orange-800/60 dark:text-orange-300'
        >
          +{booking.lateMinutes}m
        </Badge>
      )}
      <span className='text-xs tabular-nums text-muted-foreground'>
        {formatTime(booking.startTime)}
      </span>
    </span>
  )
}

/**
 * Truk yang sudah check-in dan belum masuk dock. Penempatan dock terjadi saat
 * truk tiba, jadi daftar ini belum bisa dipecah per dock — ia ditampilkan
 * sebagai satu antrean bersama dengan tautan ke halaman Antrean.
 */
export function DockQueueStrip({ queue }: { queue: QueueResponse }) {
  const waiting = waitingCount(queue)
  if (waiting === 0) return null

  const urgent = queue.late.slice(0, 2)
  const preview = [...urgent, ...queue.onTime].slice(0, 3)

  return (
    <Card className='gap-0 py-0'>
      <div className='flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0 space-y-0.5'>
          <p className='flex items-center gap-2 text-sm font-medium'>
            <Clock className='size-4 text-muted-foreground' aria-hidden />
            {waiting} truk menunggu di antrean
          </p>
          <p className='text-xs text-muted-foreground'>
            Sudah check-in, belum masuk dock.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {preview.map((booking) => (
            <QueueChip key={booking.id} booking={booking} />
          ))}
          <Button asChild variant='outline' size='sm' className='h-9'>
            <Link to='/queue'>
              Buka antrean <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}
