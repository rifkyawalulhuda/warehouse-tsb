import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  fetchOpsDocks,
  fetchQueue,
  finishProcess,
  startProcess,
} from '@/lib/api/endpoints'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { useNow } from '@/hooks/use-now'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { activityLabels, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DockCard } from './dock-card'
import {
  dockFilterCounts,
  dockFilterLabels,
  dockFilters,
  groupDocks,
  waitingCount,
  type DockFilter,
  type DockPhase,
} from './dock-model'
import { DockSummary, DockQueueStrip } from './dock-summary'
import { DockTile } from './dock-tile'

const groupTitles: Record<DockPhase, string> = {
  starting: 'Perlu dimulai',
  serving: 'Sedang diproses',
  available: 'Dock kosong',
  maintenance: 'Perawatan',
}

/**
 * Tindakan yang mengubah siapa yang boleh masuk dock, jadi selalu lewat
 * konfirmasi — tombol di layar sentuh mudah tersentuh tanpa sengaja.
 */
type PendingAction = {
  kind: 'start' | 'finish'
  booking: Booking
  dock: DockWithBooking
}

export function DockBoard() {
  useRealtimeSync()
  const queryClient = useQueryClient()
  const today = todayISO()

  const docks = useQuery({ queryKey: ['ops', 'docks'], queryFn: fetchOpsDocks })

  // Antrean hanya pelengkap: bila gagal dimuat, papan dock tetap bisa dipakai.
  const queue = useQuery({
    queryKey: ['ops', 'queue', today],
    queryFn: () => fetchQueue(today),
  })

  const serving = (docks.data ?? []).some(
    (dock) => dock.currentBooking?.status === 'IN_PROGRESS'
  )
  // Detak hanya hidup selama ada proses berjalan; tanpa itu tidak ada angka
  // yang perlu diperbarui tiap 30 detik.
  const now = useNow(30_000, serving)

  const [filter, setFilter] = useState<DockFilter>('all')
  const [search, setSearch] = useState('')

  const [pending, setPending] = useState<PendingAction | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ops'] })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }

  const start = useMutation({
    mutationFn: (bookingId: string) => startProcess(bookingId),
    onSuccess: () => {
      toast.success('Proses dimulai')
      setPending(null)
      invalidate()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const finish = useMutation({
    mutationFn: (bookingId: string) => finishProcess(bookingId),
    onSuccess: () => {
      toast.success('Proses selesai, dock kembali tersedia')
      setPending(null)
      invalidate()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  if (docks.isPending) return <LoadingBlock label='Memuat dock...' />
  if (docks.isError)
    return <ErrorBlock error={docks.error} onRetry={() => void docks.refetch()} />

  const counts = dockFilterCounts(docks.data)
  const groups = groupDocks(docks.data, filter, search)
  const waiting = waitingCount(queue.data)
  const isFiltered = filter !== 'all' || search.trim() !== ''

  const resetFilters = () => {
    setFilter('all')
    setSearch('')
  }

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Papan Dock'
        description={`${counts.serving} sedang diproses · ${counts.action} perlu dimulai · ${counts.empty} kosong.`}
      />

      <DockSummary docks={docks.data} waiting={waiting} />

      {queue.data && <DockQueueStrip queue={queue.data} />}

      <Card className='gap-0 py-0'>
        <div className='flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between'>
          <div
            role='group'
            aria-label='Saring dock'
            className='-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0'
          >
            {dockFilters.map((value) => {
              const active = filter === value
              return (
                <Button
                  key={value}
                  variant={active ? 'secondary' : 'outline'}
                  aria-pressed={active}
                  className='h-11 shrink-0 sm:h-9'
                  onClick={() => setFilter(value)}
                >
                  {dockFilterLabels[value]}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs tabular-nums',
                      active
                        ? 'bg-foreground/10 text-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {counts[value]}
                  </span>
                </Button>
              )
            })}
          </div>

          <div className='flex items-center gap-2'>
            <div className='relative w-full lg:w-72'>
              <Search
                aria-hidden
                className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground'
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label='Cari dock, kode booking, plat, atau customer'
                placeholder='Cari dock, booking, plat...'
                className='h-11 ps-9 sm:h-9'
              />
            </div>
            {isFiltered && (
              <Button variant='ghost' className='h-11 sm:h-9' onClick={resetFilters}>
                Atur ulang
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div
        aria-live='polite'
        role='status'
        className='sr-only'
      >
        {groups.reduce((total, group) => total + group.docks.length, 0)} dock
        ditampilkan
      </div>

      {docks.data.length === 0 ? (
        <Card>
          <div className='flex flex-col items-center gap-2 px-6 text-center'>
            <Truck className='size-8 text-muted-foreground' aria-hidden />
            <p className='text-sm font-medium'>Belum ada dock</p>
            <p className='text-sm text-muted-foreground'>
              Tambahkan dock lewat Master Data agar papan ini terisi.
            </p>
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <div className='flex flex-col items-center gap-3 px-6 text-center'>
            <p className='text-sm font-medium'>Tidak ada dock yang cocok</p>
            <p className='text-sm text-muted-foreground'>
              Ubah kata kunci atau kembali ke semua dock.
            </p>
            <Button variant='outline' onClick={resetFilters}>
              Tampilkan semua dock
            </Button>
          </div>
        </Card>
      ) : (
        groups.map((group) => (
          <section
            key={group.phase}
            aria-labelledby={`dock-group-${group.phase}`}
            className='flex flex-col gap-3'
          >
            <div className='flex items-center gap-2'>
              <h2
                id={`dock-group-${group.phase}`}
                className='text-sm font-semibold'
              >
                {groupTitles[group.phase]}
              </h2>
              <Badge variant='secondary' className='tabular-nums'>
                {group.docks.length}
              </Badge>
            </div>

            {group.phase === 'starting' || group.phase === 'serving' ? (
              <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-3'>
                {group.docks.map((dock) => (
                  <DockCard
                    key={dock.id}
                    dock={dock}
                    now={now}
                    actionPending={start.isPending || finish.isPending}
                    onStart={(booking, targetDock) =>
                      setPending({ kind: 'start', booking, dock: targetDock })
                    }
                    onFinish={(booking, targetDock) =>
                      setPending({ kind: 'finish', booking, dock: targetDock })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {group.docks.map((dock) => (
                  <DockTile key={dock.id} dock={dock} />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'start'
            ? 'Mulai proses di dock ini?'
            : 'Selesaikan proses ini?'
        }
        desc={
          pending ? (
            <div className='space-y-2'>
              <p>
                {pending.kind === 'start'
                  ? 'Waktu mulai proses dicatat sebagai sekarang dan dock ditandai sedang dipakai.'
                  : 'Waktu selesai dicatat dan dock langsung dibebaskan untuk truk berikutnya.'}
              </p>
              <div className='rounded-md border bg-muted/50 p-3 text-xs'>
                <p className='font-mono text-sm font-semibold text-foreground'>
                  {pending.booking.bookingCode}
                </p>
                <p className='mt-1 text-foreground'>
                  {pending.dock.dockCode}
                  {pending.booking.licensePlate
                    ? ` · ${pending.booking.licensePlate}`
                    : ' · plat belum diisi'}
                </p>
                <p className='mt-0.5'>
                  {pending.booking.customer.name} ·{' '}
                  {activityLabels[pending.booking.activityType]}
                </p>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText={
          pending?.kind === 'start' ? 'Ya, mulai proses' : 'Ya, selesaikan'
        }
        cancelBtnText='Batal'
        isLoading={start.isPending || finish.isPending}
        handleConfirm={() => {
          if (!pending) return
          if (pending.kind === 'start') start.mutate(pending.booking.id)
          else finish.mutate(pending.booking.id)
        }}
      />
    </Main>
  )
}
