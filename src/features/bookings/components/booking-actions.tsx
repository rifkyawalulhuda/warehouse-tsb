import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, PencilLine, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { cancelBooking } from '@/lib/api/endpoints'
import type { Booking } from '@/lib/api/types'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VehicleDialog } from './vehicle-dialog'

const CANCELLABLE = ['BOOKED_INCOMPLETE', 'BOOKED_READY']

/**
 * Tombol aksi dan dialognya untuk satu booking.
 *
 * Dipisah dari kartu karena halaman ini menampilkan booking dalam tiga bentuk
 * (kartu, baris, jadwal). Kalau tiap bentuk menyusun sendiri tombol dan
 * dialognya, aturan "boleh batal" akan bercabang di tiga tempat dan cepat
 * menyimpang.
 */
export function BookingActions({
  booking,
  layout = 'inline',
  ticketVariant = 'outline',
}: {
  booking: Booking
  layout?: 'inline' | 'stacked'
  ticketVariant?: 'outline' | 'ghost'
}) {
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
  const stacked = layout === 'stacked'

  return (
    <>
      <div
        className={cn(
          'flex gap-2',
          stacked ? 'flex-col items-stretch' : 'flex-wrap items-center justify-end'
        )}
      >
        {needsVehicle && (
          <Button
            size='sm'
            className={stacked ? 'w-full' : undefined}
            onClick={() => setVehicleOpen(true)}
          >
            <PencilLine />
            Lengkapi kendaraan
          </Button>
        )}
        <Button asChild variant={ticketVariant} size='sm' className={stacked ? 'w-full' : undefined}>
          <Link to='/t/$token' params={{ token: booking.qrToken }} target='_blank'>
            <ExternalLink />
            Tiket
          </Link>
        </Button>
        {canCancel && (
          <Button
            variant='ghost'
            size='sm'
            className={cn(
              'text-destructive hover:text-destructive',
              stacked ? 'w-full' : undefined
            )}
            onClick={() => setCancelOpen(true)}
          >
            <XCircle />
            Batalkan
          </Button>
        )}
      </div>

      <VehicleDialog booking={booking} open={vehicleOpen} onOpenChange={setVehicleOpen} />

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
