import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, PlayCircle, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  fetchOpsDocks,
  finishProcess,
  startProcess,
} from '@/lib/api/endpoints'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Papan dock untuk checker. Setiap kartu mewakili satu dock fisik; checker
 * memakai tombol di dalamnya untuk memulai dan menyelesaikan bongkar/muat.
 */
export function DockBoard() {
  useRealtimeSync()
  const queryClient = useQueryClient()

  const docks = useQuery({ queryKey: ['ops', 'docks'], queryFn: fetchOpsDocks })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ops'] })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }

  const start = useMutation({
    mutationFn: (bookingId: string) => startProcess(bookingId),
    onSuccess: () => {
      toast.success('Proses dimulai')
      invalidate()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const finish = useMutation({
    mutationFn: (bookingId: string) => finishProcess(bookingId),
    onSuccess: () => {
      toast.success('Proses selesai, dock kembali tersedia')
      invalidate()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  if (docks.isPending) return <LoadingBlock label='Memuat dock...' />
  if (docks.isError)
    return <ErrorBlock error={docks.error} onRetry={() => void docks.refetch()} />

  const busy = docks.data.filter((dock) => dock.currentBooking !== null).length

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Papan Dock'
        description={`${busy} dari ${docks.data.length} dock sedang melayani truk.`}
      />

      {docks.data.length === 0 ? (
        <Card>
          <CardContent className='py-12 text-center text-sm text-muted-foreground'>
            Belum ada dock. Tambahkan lewat Master Data.
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {docks.data.map((dock) => {
            const booking = dock.currentBooking
            const maintenance = dock.currentStatus === 'MAINTENANCE'

            return (
              <Card
                key={dock.id}
                className={cn(
                  maintenance && 'opacity-60',
                  booking?.status === 'IN_PROGRESS' && 'border-blue-300/70'
                )}
              >
                <CardContent className='space-y-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='inline-flex items-center gap-2 text-lg font-semibold'>
                      <Truck className='size-5 text-muted-foreground' />
                      {dock.dockCode}
                    </span>
                    <DockStatus status={dock.currentStatus} />
                  </div>

                  <p className='text-xs text-muted-foreground'>
                    {dock.allowedActivity === 'BOTH'
                      ? 'Loading & Unloading'
                      : dock.allowedActivity === 'LOADING'
                        ? 'Loading saja'
                        : 'Unloading saja'}
                  </p>

                  {booking ? (
                    <div className='space-y-3 rounded-lg bg-muted/60 p-3'>
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <span className='font-mono text-sm font-semibold'>
                          {booking.bookingCode}
                        </span>
                        <StatusBadge status={booking.status} />
                      </div>
                      <div className='space-y-1 text-sm'>
                        <p className='font-medium'>
                          {booking.licensePlate ?? 'Plat belum diisi'}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {booking.customer.companyName ?? booking.customer.name}
                          {booking.driverName ? ` · ${booking.driverName}` : ''}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Jadwal {formatTime(booking.startTime)}–
                          {formatTime(booking.endTime)}
                          {booking.timeLog?.gateInAt
                            ? ` · masuk ${formatTime(booking.timeLog.gateInAt)}`
                            : ''}
                        </p>
                      </div>

                      {booking.status === 'DOCK_ASSIGNED' && (
                        <Button
                          size='sm'
                          className='w-full'
                          disabled={start.isPending}
                          onClick={() => start.mutate(booking.id)}
                        >
                          <PlayCircle /> Mulai proses
                        </Button>
                      )}
                      {booking.status === 'IN_PROGRESS' && (
                        <Button
                          size='sm'
                          className='w-full'
                          disabled={finish.isPending}
                          onClick={() => finish.mutate(booking.id)}
                        >
                          <CheckCircle2 /> Selesaikan proses
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className='rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground'>
                      {maintenance ? 'Dalam perawatan' : 'Menunggu truk'}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </Main>
  )
}

function DockStatus({ status }: { status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' }) {
  if (status === 'AVAILABLE')
    return (
      <Badge variant='outline' className='border-emerald-300 text-emerald-700'>
        Tersedia
      </Badge>
    )
  if (status === 'OCCUPIED')
    return (
      <Badge variant='outline' className='border-blue-300 text-blue-700'>
        Terpakai
      </Badge>
    )
  return (
    <Badge variant='outline' className='border-slate-300 text-slate-600'>
      Perawatan
    </Badge>
  )
}
