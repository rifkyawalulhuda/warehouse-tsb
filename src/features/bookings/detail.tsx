import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, PencilLine, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { cancelBooking, fetchBooking } from '@/lib/api/endpoints'
import { useRealtimeSync } from '@/hooks/use-realtime'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDate,
  formatTime,
} from '@/lib/format'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { VehicleDialog } from './components/vehicle-dialog'

const CANCELLABLE = ['BOOKED_INCOMPLETE', 'BOOKED_READY']

export function BookingDetail() {
  const { bookingId } = useParams({ from: '/_authenticated/bookings/$bookingId' })
  useRealtimeSync()

  const queryClient = useQueryClient()
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['bookings', 'detail', bookingId],
    queryFn: () => fetchBooking(bookingId),
  })

  const cancel = useMutation({
    mutationFn: () => cancelBooking(bookingId),
    onSuccess: () => {
      toast.success('Booking dibatalkan')
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelOpen(false)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  if (isPending) return <LoadingBlock label='Memuat booking...' />
  if (isError) return <ErrorBlock error={error} onRetry={() => void refetch()} />

  const booking = data

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title={booking.bookingCode}
        description={`${activityLabels[booking.activityType]} · ${booking.truckType.truckName}`}
        actions={
          <>
            <Button asChild variant='outline' size='sm'>
              <Link to='/bookings'>
                <ArrowLeft /> Kembali
              </Link>
            </Button>
            <Button asChild variant='outline' size='sm'>
              <Link to='/t/$token' params={{ token: booking.qrToken }} target='_blank'>
                <ExternalLink /> Tiket
              </Link>
            </Button>
            {booking.status === 'BOOKED_INCOMPLETE' && (
              <Button size='sm' onClick={() => setVehicleOpen(true)}>
                <PencilLine /> Lengkapi kendaraan
              </Button>
            )}
            {CANCELLABLE.includes(booking.status) && (
              <Button
                variant='ghost'
                size='sm'
                className='text-destructive hover:text-destructive'
                onClick={() => setCancelOpen(true)}
              >
                <XCircle /> Batalkan
              </Button>
            )}
          </>
        }
      />

      <div className='grid gap-6 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>Jadwal & dokumen</CardTitle>
            <CardDescription>
              Slot yang dipesan tidak bisa diubah. Batalkan lalu buat ulang bila perlu
              pindah jam.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 sm:grid-cols-2'>
            <Field label='Status'>
              <StatusBadge status={booking.status} />
            </Field>
            <Field label='Tanggal'>{formatDate(booking.bookingDate)}</Field>
            <Field label='Jam'>
              {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
            </Field>
            <Field label='Durasi'>
              {durationLabel(bookingDurationMinutes(booking))} ({booking.blocksLocked} blok)
            </Field>
            <Field label='Nomor dokumen'>{booking.referenceDocNo}</Field>
            <Field label='Dock'>{booking.assignedDock?.dockCode ?? 'Belum ditentukan'}</Field>
            <Field label='Plat nomor'>{booking.licensePlate ?? 'Belum diisi'}</Field>
            <Field label='Supir'>{booking.driverName ?? 'Belum diisi'}</Field>
            <Field label='Nomor HP'>{booking.driverPhone ?? '-'}</Field>
            {booking.lateMinutes > 0 && (
              <Field label='Keterlambatan'>{booking.lateMinutes} menit</Field>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Riwayat waktu</CardTitle>
            <CardDescription>Jejak setiap perpindahan status.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <Timeline label='Data kendaraan lengkap' value={booking.timeLog?.vehicleCompletedAt} />
            <Timeline label='Masuk gate' value={booking.timeLog?.gateInAt} />
            <Timeline label='Dapat dock' value={booking.timeLog?.dockAssignedAt} />
            <Timeline label='Mulai proses' value={booking.timeLog?.processStartedAt} />
            <Timeline label='Selesai proses' value={booking.timeLog?.processCompletedAt} />
            <Timeline label='Keluar gate' value={booking.timeLog?.gateOutAt} />
          </CardContent>
        </Card>
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
    </Main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-1'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <div className='text-sm font-medium'>{children}</div>
    </div>
  )
}

function Timeline({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className='flex items-center justify-between gap-3 border-b pb-2 last:border-0 last:pb-0'>
      <span className='text-muted-foreground'>{label}</span>
      <span className={value ? 'font-medium tabular-nums' : 'text-muted-foreground'}>
        {value ? formatTime(value) : '-'}
      </span>
    </div>
  )
}
