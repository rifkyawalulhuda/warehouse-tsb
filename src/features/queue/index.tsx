import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarCheck2, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import {
  assignDock,
  fetchOpsDocks,
  fetchQueue,
  markNoShow,
  unassignDock,
} from '@/lib/api/endpoints'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { todayISO } from '@/lib/format'
import { dockOptionLabel } from '@/lib/dock-label'
import { cn } from '@/lib/utils'
import { useNow } from '@/hooks/use-now'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { ApprovalsPanel } from '@/features/approvals'
import { QueueCompact } from './queue-compact'
import { QueueGrid } from './queue-grid'
import { QueueCardList, QueueLane } from './queue-lane'
import {
  defaultLaneKey,
  laneTitle,
  queueLanes,
  queueRows,
  queueTotals,
  type QueueLaneKey,
} from './queue-model'
import { QueueSummary, type QueueFilter } from './queue-summary'
import { QueueTable } from './queue-table'
import { useQueueView } from './use-queue-view'
import { QueueViewSwitch } from './queue-view-switch'

type AssignVars = { bookingId: string; dockId: number; dockCode: string }

/** Pilih dock yang menunggu konfirmasi sebelum benar-benar ditugaskan. */
type PendingAssign = { booking: Booking; dock: DockWithBooking }

/**
 * Papan antrean satu hari: empat lane menurut tahap kerja, bukan tiga tabel
 * bertumpuk. Kartu diurutkan dari yang paling lama menunggu, dan jam tunggu
 * berdetak dari gate-in supaya truk yang tertahan terlihat tanpa dibuka dulu.
 *
 * Penugasan dock selalu lewat satu konfirmasi: tombol utama dan pemilih dock
 * sama-sama membuka dialog yang menyebut kode dock, area, dan gudangnya. Toasts
 * tidak dipakai untuk konfirmasi karena hilang sendiri dalam beberapa detik —
 * keputusan yang mengubah kuota slot tidak boleh bergantung pada kecepatan mata.
 * Setelah truk ditempatkan, toast tetap memberi jalan "Urungkan".
 */
export function QueuePage() {
  useRealtimeSync()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const [date, setDate] = useState(todayISO())
  const [tab, setTab] = useState<'queue' | 'approvals'>('queue')
  const [noShowTarget, setNoShowTarget] = useState<Booking | null>(null)
  const [pendingAssign, setPendingAssign] = useState<PendingAssign | null>(null)
  /** Dinaikkan setiap penugasan dipakai, supaya pemilih dock kembali kosong. */
  const [assignReset, setAssignReset] = useState(0)

  /**
   * Saringan papan (desktop) dan pemilih lane (layar sempit) sengaja terpisah:
   * di desktop penyaring menyembunyikan lane lain, sedangkan di ponsel tab
   * menampilkan satu lane dengan judulnya. Keduanya tidak pernah tampil
   * bersamaan.
   */
  const [filter, setFilter] = useState<QueueFilter>('all')
  const [mobileLane, setMobileLane] = useState<QueueLaneKey | null>(null)

  // Server tetap menolak sendiri (403). Ini hanya agar tab yang pasti gagal
  // tidak ditawarkan — Checker tanpa flag tidak punya hak menyetujui.
  const canApprove =
    currentUser?.role === 'ADMIN' || currentUser?.canApproveBooking === true

  const queue = useQuery({
    queryKey: ['ops', 'queue', date],
    queryFn: () => fetchQueue(date),
  })
  const docks = useQuery({ queryKey: ['ops', 'docks'], queryFn: fetchOpsDocks })

  /** Tampilan disimpan per akun; papan lane tetap jadi bawaan. */
  const { view, setView } = useQueueView()

  const lanes = useMemo(
    () => (queue.data ? queueLanes(queue.data) : []),
    [queue.data]
  )
  const totals = useMemo(
    () => (queue.data ? queueTotals(queue.data) : null),
    [queue.data]
  )

  const activeLane = mobileLane ?? defaultLaneKey(lanes)
  const filteredLane =
    filter === 'all'
      ? null
      : (lanes.find((lane) => lane.key === filter) ?? null)

  /** Daftar datar untuk tampilan selain papan, tetap urut tahap. */
  const rows = useMemo(() => queueRows(lanes, filter), [lanes, filter])

  // Jam tunggu hanya perlu berdetak saat tab antrean tampil.
  const now = useNow(30_000, tab === 'queue')

  /**
   * Pembatalan penugasan. Kalau proses sudah berjalan, server menolak dan
   * pesannya diteruskan apa adanya — checker perlu tahu truk itu tidak bisa
   * dipindahkan lagi, bukan sekadar "gagal".
   */
  const unassign = useMutation({
    mutationFn: (bookingId: string) => unassignDock(bookingId),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      toast.success(`Penugasan ${booking.bookingCode} dibatalkan`)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const assign = useMutation({
    mutationFn: ({ bookingId, dockId }: AssignVars) =>
      assignDock(bookingId, dockId),
    onSuccess: (booking, variables) => {
      setAssignReset((n) => n + 1)
      setPendingAssign(null)
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      toast.success(`${booking.bookingCode} ke ${variables.dockCode}`, {
        description:
          'Truk menempati dock. Proses bisa dimulai dari Papan Dock.',
        // Pembatalan salah pilih butuh waktu membaca; 4 detik bawaan terlalu cepat.
        duration: 8_000,
        action: {
          label: 'Urungkan',
          onClick: () => unassign.mutate(booking.id),
        },
      })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const noShow = useMutation({
    mutationFn: (bookingId: string) => markNoShow(bookingId),
    onSuccess: () => {
      toast.success('Ditandai no-show')
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
      setNoShowTarget(null)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const availableDocks = useMemo(
    () =>
      (docks.data ?? []).filter((dock) => dock.currentStatus === 'AVAILABLE'),
    [docks.data]
  )

  function assignTo(booking: Booking, dock: DockWithBooking) {
    setPendingAssign({ booking, dock })
  }

  const cardHandlers = {
    docks: availableDocks,
    onQuickAssign: assignTo,
    onPickDock: assignTo,
    onNoShow: setNoShowTarget,
    assigning: assign.isPending,
    assignReset,
  }

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Antrean Hari Ini'
        description='Truk hari ini menurut tahap: terlambat, menunggu dock, di dock, dan belum datang.'
        actions={
          tab === 'queue' ? (
            <>
              <QueueViewSwitch value={view} onChange={setView} />
              <DatePicker value={date} onChange={setDate} className='w-44' />
            </>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'queue' | 'approvals')}
      >
        <TabsList>
          <TabsTrigger value='queue'>Antrean</TabsTrigger>
          {canApprove && (
            <TabsTrigger value='approvals'>Persetujuan</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {tab === 'approvals' ? (
        <ApprovalsPanel />
      ) : queue.isPending ? (
        <LoadingBlock label='Memuat antrean...' />
      ) : queue.isError ? (
        <ErrorBlock error={queue.error} onRetry={() => void queue.refetch()} />
      ) : totals && totals.total === 0 ? (
        <EmptyDay date={date} onToday={() => setDate(todayISO())} />
      ) : (
        <>
          {/*
            Saringan tahap. Di papan versi ponsel, tab lane sudah memilih satu
            tahap, jadi chip cukup tampil di desktop. Di tampilan lain chip
            adalah satu-satunya penyaring, jadi ia tampil di semua lebar dan
            digeser mendatar alih-alih melipat jadi tiga baris.
          */}
          <QueueSummary
            lanes={lanes}
            total={totals?.total ?? 0}
            value={filter}
            onChange={setFilter}
            className={
              view === 'board'
                ? 'hidden md:flex'
                : 'max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-1'
            }
          />

          <p aria-live='polite' className='sr-only'>
            {view === 'board' && filteredLane
              ? `${filteredLane.bookings.length} truk di tahap ${filteredLane.title}`
              : `${rows.length} truk ditampilkan dari ${totals?.total ?? 0} hari ini`}
          </p>

          {view !== 'board' && rows.length === 0 ? (
            <NoRows filter={filter} onReset={() => setFilter('all')} />
          ) : view === 'list' ? (
            <QueueTable rows={rows} now={now} {...cardHandlers} />
          ) : view === 'cards' ? (
            <QueueGrid rows={rows} now={now} {...cardHandlers} />
          ) : view === 'compact' ? (
            <QueueCompact rows={rows} now={now} {...cardHandlers} />
          ) : filteredLane ? (
            <QueueLane
              lane={filteredLane}
              now={now}
              columns={3}
              className={cn('hidden bg-card md:flex')}
              {...cardHandlers}
            />
          ) : (
            <div className='hidden items-start gap-4 md:grid md:grid-cols-2 xl:grid-cols-4'>
              {lanes.map((lane) => (
                <QueueLane
                  key={lane.key}
                  lane={lane}
                  now={now}
                  {...cardHandlers}
                />
              ))}
            </div>
          )}

          {/* Papan di layar sempit: satu lane sekaligus, tab bisa digeser.
              Tampilan lain sudah berupa daftar datar, jadi tab ini hanya
              milik papan. */}
          {view === 'board' && (
            <Tabs
              value={activeLane}
              onValueChange={(value) => {
                if (value) setMobileLane(value as QueueLaneKey)
              }}
              className='md:hidden'
            >
              <TabsList className='w-full justify-start overflow-x-auto'>
                {lanes.map((lane) => (
                  <TabsTrigger
                    key={lane.key}
                    value={lane.key}
                    className='shrink-0 gap-1.5'
                  >
                    {lane.shortTitle}
                    <span className='text-xs text-muted-foreground tabular-nums'>
                      {lane.bookings.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {lanes.map((lane) => (
                <TabsContent key={lane.key} value={lane.key} className='mt-3'>
                  <QueueCardList lane={lane} now={now} {...cardHandlers} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingAssign !== null}
        onOpenChange={(open) => {
          if (open) return
          setPendingAssign(null)
          // Pemilih dock dikosongkan lagi: pilihan tadi batal atau sudah dipakai.
          setAssignReset((n) => n + 1)
        }}
        title={
          pendingAssign
            ? `Tugaskan ke ${dockOptionLabel(pendingAssign.dock)}?`
            : ''
        }
        desc={
          pendingAssign
            ? `${pendingAssign.booking.bookingCode} · ${pendingAssign.booking.customer.name} · ${pendingAssign.booking.licensePlate ?? 'tanpa plat'} akan menempati dock ini.`
            : ''
        }
        confirmText='Ya, tugaskan'
        cancelBtnText='Batal'
        isLoading={assign.isPending}
        handleConfirm={() =>
          pendingAssign &&
          assign.mutate({
            bookingId: pendingAssign.booking.id,
            dockId: pendingAssign.dock.id,
            dockCode: pendingAssign.dock.dockCode,
          })
        }
      />

      <ConfirmDialog
        open={noShowTarget !== null}
        onOpenChange={(open) => !open && setNoShowTarget(null)}
        title='Tandai no-show?'
        desc={
          noShowTarget
            ? `Booking ${noShowTarget.bookingCode} akan ditandai tidak datang dan slotnya dikembalikan.`
            : ''
        }
        confirmText='Ya, tandai no-show'
        cancelBtnText='Batal'
        destructive
        isLoading={noShow.isPending}
        handleConfirm={() => noShowTarget && noShow.mutate(noShowTarget.id)}
      />
    </Main>
  )
}

/**
 * Saringan yang tidak menyisakan satu pun truk. Kotak kosong tanpa penjelasan
 * membuat checker mengira datanya hilang; di sini ia diberi satu jalan keluar.
 */
function NoRows({
  filter,
  onReset,
}: {
  filter: QueueFilter
  onReset: () => void
}) {
  return (
    <div className='flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center'>
      <SearchX className='size-8 text-muted-foreground/70' aria-hidden />
      <div className='space-y-1'>
        <p className='font-medium'>Tidak ada truk di tahap ini</p>
        <p className='max-w-sm text-sm text-muted-foreground'>
          {filter === 'all'
            ? 'Belum ada truk yang cocok pada tanggal ini.'
            : `Tidak satu pun truk berada di tahap ${laneTitle[filter]} pada tanggal ini.`}
        </p>
      </div>
      {filter !== 'all' && (
        <Button variant='outline' onClick={onReset}>
          Tampilkan semua tahap
        </Button>
      )}
    </div>
  )
}

/** Hari tanpa satu pun booking: jelaskan, jangan tampilkan empat kotak kosong. */
function EmptyDay({ date, onToday }: { date: string; onToday: () => void }) {
  const isToday = date === todayISO()

  return (
    <div className='flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center'>
      <CalendarCheck2 className='size-8 text-muted-foreground/70' aria-hidden />
      <div className='space-y-1'>
        <p className='font-medium'>Tidak ada antrean untuk tanggal ini</p>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Belum ada booking yang dijadwalkan pada {date}. Pilih tanggal lain,
          atau lihat booking yang menunggu persetujuan.
        </p>
      </div>
      <div className='flex flex-wrap items-center justify-center gap-2'>
        {!isToday && (
          <Button variant='outline' onClick={onToday}>
            Hari ini
          </Button>
        )}
        <Button asChild variant='ghost'>
          <Link to='/bookings'>Lihat semua booking</Link>
        </Button>
      </div>
    </div>
  )
}
