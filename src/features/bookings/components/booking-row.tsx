import { Link } from '@tanstack/react-router'
import { ChevronRight, MapPin, Truck } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDateCompact,
  formatTime,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApprovalBadge } from '@/components/approval-badge'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { BookingActions } from './booking-actions'
import { bookingUrgency, dockLabel } from '../booking-view'

/**
 * Baris booking untuk tampilan daftar.
 *
 * Dua baris teks, bukan satu: baris atas menjawab "kapan", baris bawah
 * "truk apa dan di mana". Satu baris akan memaksa pemotongan nama truk di
 * layar 390px, dan informasi yang terpotong justru yang menentukan.
 */
export function BookingRow({
  booking,
  now,
  showDate,
}: {
  booking: Booking
  now: Date
  showDate: boolean
}) {
  const urgency = bookingUrgency(booking, now)
  const isLive = urgency.key === 'in-progress'
  const isImminent = urgency.key === 'imminent'

  return (
    <li
      className={cn(
        'group relative flex items-center gap-3 px-4 py-3 transition-colors duration-150',
        'hover:bg-muted/50 focus-within:bg-muted/50'
      )}
    >
      {/* Penanda status di tepi kiri, hanya untuk booking yang sedang berjalan. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-2 start-0 w-0.5 rounded-full',
          isLive && 'bg-blue-500',
          isImminent && 'bg-amber-500'
        )}
      />

      <div className='w-20 shrink-0 tabular-nums sm:w-24'>
        <p className='text-sm leading-tight font-semibold'>{formatTime(booking.startTime)}</p>
        <p className='text-[11px] leading-tight text-muted-foreground'>
          {formatTime(booking.endTime)}
        </p>
        {showDate && (
          <p className='mt-0.5 text-[11px] leading-tight whitespace-nowrap text-muted-foreground'>
            {formatDateCompact(booking.bookingDate)}
          </p>
        )}
      </div>

      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-1.5'>
          <Link
            to='/bookings/$bookingId'
            params={{ bookingId: booking.id }}
            className='truncate font-mono text-xs font-semibold underline-offset-4 after:absolute after:inset-0 after:content-[""] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60'
          >
            {booking.bookingCode}
          </Link>
          <StatusBadge status={booking.status} className='hidden sm:inline-flex' />
        </div>
        <p className='mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground'>
          <span className='inline-flex items-center gap-1'>
            <Truck className='size-3' aria-hidden />
            {booking.licensePlate ?? 'Belum diisi'}
          </span>
          <span aria-hidden>·</span>
          <span>{booking.truckType.truckName}</span>
          <span aria-hidden className='hidden sm:inline'>
            ·
          </span>
          <span className='hidden sm:inline'>{activityLabels[booking.activityType]}</span>
          <span aria-hidden>·</span>
          <span className='inline-flex items-center gap-1'>
            <MapPin className='size-3' aria-hidden />
            {dockLabel(booking)}
          </span>
          <span aria-hidden>·</span>
          <span>{durationLabel(bookingDurationMinutes(booking))}</span>
        </p>
        <div className='mt-1 flex flex-wrap items-center gap-1 sm:hidden'>
          <StatusBadge status={booking.status} />
          <ApprovalBadge status={booking.approvalStatus} />
        </div>
      </div>

      <div className='hidden shrink-0 items-center gap-1.5 md:flex'>
        <ApprovalBadge status={booking.approvalStatus} />
        {isLive && (
          <Badge variant='outline' className='border-blue-300 text-blue-700 dark:text-blue-300'>
            {urgency.label}
          </Badge>
        )}
        {isImminent && (
          <Badge
            variant='outline'
            className='border-amber-300 text-amber-700 dark:text-amber-300'
          >
            {urgency.label}
          </Badge>
        )}
        {booking.lateMinutes > 0 && (
          <Badge variant='outline' className='border-orange-300 text-orange-700 dark:text-orange-300'>
            +{booking.lateMinutes}m
          </Badge>
        )}
      </div>

      <div className='relative z-10 hidden shrink-0 md:block'>
        <BookingActions booking={booking} ticketVariant='ghost' />
      </div>

      <ChevronRight
        className='size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 md:hidden'
        aria-hidden
      />
    </li>
  )
}
