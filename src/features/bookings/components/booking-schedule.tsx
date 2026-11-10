import { Link } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import { activityLabels, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApprovalBadge } from '@/components/approval-badge'
import { StatusBadge } from '@/components/status-badge'
import { bookingUrgency, dockLabel, type BookingDay } from '../booking-view'

/**
 * Tampilan jadwal: booking dikelompokkan per hari sebagai garis waktu.
 *
 * Berguna ketika customer punya beberapa booking dalam sepekan dan ingin
 * melihat sebarannya, bukan daftar datar. Garis vertikal di kiri menautkan
 * jam ke tanggalnya sehingga jarak antar-booking terbaca sebagai waktu.
 */
export function BookingSchedule({ days, now }: { days: BookingDay[]; now: Date }) {
  return (
    <div className='space-y-6'>
      {days.map((day) => (
        <section key={day.date} aria-label={day.label} className='space-y-2'>
          <div className='sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/85 px-1 py-1.5 backdrop-blur-sm'>
            <h2 className='text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase'>
              {day.label}
            </h2>
            <span className='h-px flex-1 bg-border' aria-hidden />
            <span className='text-xs text-muted-foreground tabular-nums'>
              {day.items.length} booking
            </span>
          </div>

          <ol className='relative space-y-2 ps-4'>
            <span
              aria-hidden
              className='absolute inset-y-2 start-[3px] w-px bg-border'
            />
            {day.items.map((booking) => (
              <ScheduleEntry key={booking.id} booking={booking} now={now} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function ScheduleEntry({ booking, now }: { booking: Booking; now: Date }) {
  const urgency = bookingUrgency(booking, now)
  const isLive = urgency.key === 'in-progress'
  const isImminent = urgency.key === 'imminent'

  return (
    <li className='group relative'>
      <span
        aria-hidden
        className={cn(
          'absolute -start-4 top-4 size-[7px] rounded-full ring-4 ring-background',
          isLive && 'bg-blue-500',
          isImminent && 'bg-amber-500',
          !isLive && !isImminent && 'bg-muted-foreground/40'
        )}
      />
      <Link
        to='/bookings/$bookingId'
        params={{ bookingId: booking.id }}
        className='flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none'
      >
        <span className='w-11 shrink-0 pt-0.5 text-sm font-semibold tabular-nums'>
          {formatTime(booking.startTime)}
        </span>

        <span className='min-w-0 flex-1'>
          <span className='flex items-center gap-1.5'>
            <span className='truncate font-mono text-xs font-semibold'>{booking.bookingCode}</span>
            <span className='hidden text-xs text-muted-foreground sm:inline'>
              {activityLabels[booking.activityType]}
            </span>
          </span>
          <span className='mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground'>
            <span className='inline-flex items-center gap-1 whitespace-nowrap'>
              <MapPin className='size-3' aria-hidden />
              {dockLabel(booking)}
            </span>
            <span aria-hidden>·</span>
            <span className='truncate'>{booking.licensePlate ?? 'Plat belum diisi'}</span>
          </span>
          <span className='mt-1 flex flex-wrap items-center gap-1 sm:hidden'>
            <StatusBadge status={booking.status} />
          </span>
        </span>

        <span className='hidden shrink-0 items-center gap-1.5 self-center sm:flex'>
          <ApprovalBadge status={booking.approvalStatus} />
          <StatusBadge status={booking.status} />
        </span>
      </Link>
    </li>
  )
}
