import { Link } from '@tanstack/react-router'
import { ArrowUpRight, MapPin, Phone, Truck } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDate,
  formatTime,
  waNumber,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { ApprovalBadge } from '@/components/approval-badge'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { BookingActions } from './booking-actions'
import { bookingUrgency, dockLabel } from '../booking-view'

const URGENCY_BORDER = {
  'in-progress': 'border-blue-300/70 dark:border-blue-800/60',
  imminent: 'border-amber-300/80 dark:border-amber-800/60',
} as const

/**
 * Kartu booking untuk tampilan kotak.
 *
 * Jam mulai dinaikkan jadi elemen terbesar: itu satu-satunya informasi yang
 * dicari customer dalam sekejap. Kartu bisa diklik di mana saja lewat lapisan
 * `after:` pada tautan kode booking; tombol aksi diberi `relative z-10` supaya
 * tetap menerima kliknya sendiri, bukan ikut membuka detail.
 */
export function BookingCard({ booking, now }: { booking: Booking; now: Date }) {
  const urgency = bookingUrgency(booking, now)
  const accent = URGENCY_BORDER[urgency.key as keyof typeof URGENCY_BORDER]

  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden py-0 transition-shadow duration-200 hover:shadow-md',
        accent
      )}
    >
      <CardContent className='px-5 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-baseline gap-1.5'>
              <span className='text-2xl leading-none font-semibold tabular-nums'>
                {formatTime(booking.startTime)}
              </span>
              <span className='text-sm text-muted-foreground tabular-nums'>
                –{formatTime(booking.endTime)}
              </span>
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              {formatDate(booking.bookingDate)} · {durationLabel(bookingDurationMinutes(booking))}
            </p>
          </div>

          <div className='flex shrink-0 items-center gap-1.5'>
            <Link
              to='/bookings/$bookingId'
              params={{ bookingId: booking.id }}
              className='font-mono text-[11px] text-muted-foreground underline-offset-4 after:absolute after:inset-0 after:content-[""] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/60'
            >
              {booking.bookingCode}
            </Link>
            <ArrowUpRight
              className='size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5'
              aria-hidden
            />
          </div>
        </div>

        <div className='mt-3 flex flex-wrap items-center gap-1.5'>
          <StatusBadge status={booking.status} />
          <ApprovalBadge status={booking.approvalStatus} />
          {(urgency.key === 'in-progress' || urgency.key === 'imminent') && (
            <Badge
              variant='outline'
              className={
                urgency.key === 'in-progress'
                  ? 'border-blue-300 text-blue-700 dark:text-blue-300'
                  : 'border-amber-300 text-amber-700 dark:text-amber-300'
              }
            >
              {urgency.label}
            </Badge>
          )}
          {booking.lateMinutes > 0 && (
            <Badge
              variant='outline'
              className='border-orange-300 text-orange-700 dark:text-orange-300'
            >
              Terlambat {booking.lateMinutes} menit
            </Badge>
          )}
        </div>

        <dl className='mt-3 grid gap-2 text-sm sm:grid-cols-2'>
          <Row icon={Truck} label='Kendaraan'>
            {booking.licensePlate ?? 'Belum diisi'}
            {booking.driverName && (
              <span className='ms-1 text-xs text-muted-foreground'>({booking.driverName})</span>
            )}
          </Row>
          <Row icon={MapPin} label='Dock'>
            {dockLabel(booking)}
          </Row>
        </dl>

        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3'>
          <p className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground'>
            <span>{activityLabels[booking.activityType]}</span>
            <span aria-hidden>·</span>
            <span>{booking.truckType.truckName}</span>
            {booking.driverPhone && (
              <>
                <span aria-hidden>·</span>
                <Phone className='size-3' aria-hidden />
                <a
                  className='relative z-10 text-primary underline-offset-2 hover:underline'
                  href={`https://wa.me/${waNumber(booking.driverPhone)}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  WA supir
                </a>
              </>
            )}
          </p>

          <div className='relative z-10'>
            <BookingActions booking={booking} ticketVariant='ghost' />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
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
      <Icon className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
      <dt className='sr-only'>{label}</dt>
      <dd className='truncate font-medium'>{children}</dd>
    </div>
  )
}

/** Placeholder saat data booking pertama kali dimuat. */
export function BookingCardSkeleton() {
  return (
    <Card className='gap-0 py-0'>
      <CardContent className='space-y-3 px-5 py-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-2'>
            <div className='h-6 w-28 animate-pulse rounded bg-muted' />
            <div className='h-3 w-36 animate-pulse rounded bg-muted' />
          </div>
          <div className='h-3 w-20 animate-pulse rounded bg-muted' />
        </div>
        <div className='flex gap-2'>
          <div className='h-5 w-24 animate-pulse rounded bg-muted' />
          <div className='h-5 w-16 animate-pulse rounded bg-muted' />
        </div>
        <div className='h-3 w-full animate-pulse rounded bg-muted' />
      </CardContent>
    </Card>
  )
}
