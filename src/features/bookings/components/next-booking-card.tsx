import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, Clock, MapPin, Truck } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDate,
  formatTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApprovalBadge } from '@/components/approval-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { BookingActions } from './booking-actions'
import { bookingUrgency, dockLabel } from '../booking-view'

const URGENCY_TONE = {
  'in-progress': {
    ring: 'ring-blue-500/25 dark:ring-blue-400/25',
    bar: 'from-blue-500/70 via-blue-400/40 to-transparent',
    badge: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  },
  imminent: {
    ring: 'ring-amber-500/25 dark:ring-amber-400/25',
    bar: 'from-amber-500/70 via-amber-400/40 to-transparent',
    badge: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  },
  today: {
    ring: 'ring-primary/15',
    bar: 'from-primary/60 via-primary/25 to-transparent',
    badge: 'border-primary/30 bg-primary/10 text-foreground',
  },
  upcoming: {
    ring: 'ring-primary/15',
    bar: 'from-primary/50 via-primary/20 to-transparent',
    badge: 'border-primary/30 bg-primary/10 text-foreground',
  },
  overdue: {
    ring: 'ring-border',
    bar: 'from-muted-foreground/40 via-muted-foreground/15 to-transparent',
    badge: 'border-border bg-muted text-muted-foreground',
  },
} as const

/**
 * Blok "booking berikutnya" di atas halaman.
 *
 * Satu booking dinaikkan bobotnya karena itulah yang dicari customer saat
 * membuka halaman: kapan truk masuk dan di mana harus turun. Booking lain tetap
 * tersedia di bawahnya, jadi blok ini tidak menyembunyikan apa pun.
 */
export function NextBookingCard({ booking, now }: { booking: Booking; now: Date }) {
  const urgency = bookingUrgency(booking, now)
  const tone = URGENCY_TONE[urgency.key]

  return (
    <section
      aria-labelledby='next-booking-heading'
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm ring-1',
        tone.ring
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r', tone.bar)}
      />
      <div className='pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl' />

      <div className='relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0 space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'>
              <span id='next-booking-heading'>Jadwal berikutnya</span>
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                tone.badge
              )}
            >
              {urgency.badge}
            </span>
          </div>

          <div className='flex flex-wrap items-end gap-x-4 gap-y-2'>
            <p className='text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl'>
              {formatTime(booking.startTime)}
              <span className='ms-1.5 text-lg font-normal text-muted-foreground sm:text-xl'>
                –{formatTime(booking.endTime)}
              </span>
            </p>
            <p className='flex items-center gap-1.5 pb-1 text-sm text-muted-foreground'>
              <CalendarDays className='size-4' aria-hidden />
              {formatDate(booking.bookingDate)}
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge status={booking.status} />
            <ApprovalBadge status={booking.approvalStatus} />
            <span className='font-mono text-xs text-muted-foreground'>{booking.bookingCode}</span>
          </div>

          <dl className='grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3'>
            <Fact icon={Truck} label='Truk'>
              {booking.truckType.truckName}
              {booking.licensePlate ? ` · ${booking.licensePlate}` : ''}
            </Fact>
            <Fact icon={MapPin} label='Dock'>
              {dockLabel(booking)}
            </Fact>
            <Fact icon={Clock} label='Durasi'>
              {durationLabel(bookingDurationMinutes(booking))}
              <span className='ms-1 text-muted-foreground'>
                · {activityLabels[booking.activityType]}
              </span>
            </Fact>
          </dl>
        </div>

        <div className='flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-stretch'>
          <Button asChild size='lg' className='group/cta sm:w-auto'>
            <Link to='/bookings/$bookingId' params={{ bookingId: booking.id }}>
              Lihat detail
              <ArrowRight className='transition-transform duration-200 group-hover/cta:translate-x-0.5' />
            </Link>
          </Button>
          <BookingActions booking={booking} layout='stacked' />
        </div>
      </div>
    </section>
  )
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <Icon className='size-4 shrink-0 text-muted-foreground' aria-hidden />
      <dt className='sr-only'>{label}</dt>
      <dd className='truncate'>{children}</dd>
    </div>
  )
}
