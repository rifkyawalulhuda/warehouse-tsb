import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CalendarDays,
  Clock,
  ExternalLink,
  MapPin,
  PencilLine,
  Phone,
  Truck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { cancelBooking } from '@/lib/api/endpoints'
import type { Booking } from '@/lib/api/types'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDate,
  formatTime,
  waNumber,
} from '@/lib/format'
import { StatusBadge } from '@/components/status-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VehicleDialog } from './vehicle-dialog'

const CANCELLABLE = ['BOOKED_INCOMPLETE', 'BOOKED_READY']

export function BookingCard({ booking }: { booking: Booking }) {
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const queryClient = useQueryClient()

  const cancel = useMutation({
    mutationFn: () => cancelBooking(booking.id),
    onSuccess: () => {
      toast.success('Booking dibatalkan')
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelOpen(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const canCancel = CANCELLABLE.includes(booking.status)
  const needsVehicle = booking.status === 'BOOKED_INCOMPLETE'

  return (
    <>
      <Card>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-mono text-sm font-semibold'>
                  {booking.bookingCode}
                </span>
                <StatusBadge status={booking.status} />
              </div>
              <p className='text-sm text-muted-foreground'>
                {activityLabels[booking.activityType]} · {booking.truckType.truckName}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {needsVehicle && (
                <Button size='sm' onClick={() => setVehicleOpen(true)}>
                  <PencilLine />
                  Lengkapi kendaraan
                </Button>
              )}
              <Button asChild variant='outline' size='sm'>
                <Link to='/t/$token' params={{ token: booking.qrToken }} target='_blank'>
                  <ExternalLink />
                  Tiket
                </Link>
              </Button>
              {canCancel && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-destructive hover:text-destructive'
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle />
                  Batalkan
                </Button>
              )}
            </div>
          </div>

          <div className='grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4'>
            <Detail icon={CalendarDays} label='Tanggal'>
              {formatDate(booking.bookingDate)}
            </Detail>
            <Detail icon={Clock} label='Jadwal'>
              {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
              <span className='ms-1 text-xs text-muted-foreground'>
                ({durationLabel(bookingDurationMinutes(booking))})
              </span>
            </Detail>
            <Detail icon={Truck} label='Kendaraan'>
              {booking.licensePlate ?? 'Belum diisi'}
              {booking.driverName && (
                <span className='block text-xs text-muted-foreground'>
                  {booking.driverName}
                </span>
              )}
            </Detail>
            <Detail icon={MapPin} label='Dock'>
              {booking.assignedDock?.dockCode ?? 'Belum ditentukan'}
            </Detail>
          </div>

          <div className='flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground'>
            <span>Dokumen: {booking.referenceDocNo}</span>
            {booking.driverPhone && (
              <span className='inline-flex items-center gap-1'>
                <Phone className='size-3' />
                {booking.driverPhone}
                <a
                  className='text-primary underline-offset-2 hover:underline'
                  href={`https://wa.me/${waNumber(booking.driverPhone)}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  WA
                </a>
              </span>
            )}
            {booking.lateMinutes > 0 && (
              <Badge variant='outline' className='border-orange-300 text-orange-700'>
                Terlambat {booking.lateMinutes} menit
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <VehicleDialog
        booking={booking}
        open={vehicleOpen}
        onOpenChange={setVehicleOpen}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title='Batalkan booking?'
        desc={`Booking ${booking.bookingCode} akan dibatalkan dan slot jamnya dikembalikan.`}
        confirmText='Ya, batalkan'
        destructive
        isLoading={cancel.isPending}
        handleConfirm={() => cancel.mutate()}
      />
    </>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex items-start gap-2'>
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p className='truncate font-medium'>{children}</p>
      </div>
    </div>
  )
}
