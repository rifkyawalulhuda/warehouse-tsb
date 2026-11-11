import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import {
  assignDock,
  fetchOpsDocks,
  fetchQueue,
  markNoShow,
} from '@/lib/api/endpoints'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { activityLabels, formatTime, todayISO } from '@/lib/format'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApprovalBadge } from '@/components/approval-badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { DatePicker } from '@/components/date-picker'
import { DockPicker } from '@/components/dock-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { ApprovalsPanel } from '@/features/approvals'

/**
 * Satu layar untuk tiga antrean yang berbeda kepentingannya: yang tepat waktu,
 * yang terlambat (menunggu dock kosong), dan yang belum datang. Urutannya
 * mengikuti jam mulai, bukan urutan kedatangan, supaya adil terhadap jadwal.
 */
export function QueuePage() {
  useRealtimeSync()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const [date, setDate] = useState(todayISO())
  const [tab, setTab] = useState<'queue' | 'approvals'>('queue')
  const [noShowTarget, setNoShowTarget] = useState<Booking | null>(null)
  /**
   * Penugasan dock menunggu konfirmasi. Memilih dock di dropdown langsung
   * mengirim permintaan, padahal salah pilih berarti truk menempati dock yang
   * salah dan harus ditugaskan ulang — jadi pilihan ditahan dulu di sini.
   */
  const [assignTarget, setAssignTarget] = useState<{
    booking: Booking
    dock: DockWithBooking
  } | null>(null)
  /**
   * Dinaikkan setiap dialog dock ditutup, supaya pemilih dock per baris
   * kembali ke placeholder. Tanpa ini pilihan yang dibatalkan tetap terlihat,
   * dan petugas bisa mengira truk sudah punya dock padahal belum.
   */
  const [assignReset, setAssignReset] = useState(0)

  // Server tetap menolak sendiri (403). Ini hanya agar tab yang pasti gagal
  // tidak ditawarkan — Checker tanpa flag tidak punya hak menyetujui.
  const canApprove =
    currentUser?.role === 'ADMIN' || currentUser?.canApproveBooking === true

  const queue = useQuery({
    queryKey: ['ops', 'queue', date],
    queryFn: () => fetchQueue(date),
  })
  const docks = useQuery({ queryKey: ['ops', 'docks'], queryFn: fetchOpsDocks })

  const assign = useMutation({
    mutationFn: ({
      bookingId,
      dockId,
    }: {
      bookingId: string
      dockId: number
    }) => assignDock(bookingId, dockId),
    onSuccess: () => {
      toast.success('Dock ditugaskan')
      setAssignTarget(null)
      setAssignReset((n) => n + 1)
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
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

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Antrean Hari Ini'
        description='Truk yang menunggu di area staging, dikelompokkan menurut status masuk.'
        actions={
          tab === 'queue' ? (
            <DatePicker value={date} onChange={setDate} className='w-44' />
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
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-4'>
            <Stat label='Tepat waktu' value={queue.data.onTime.length} />
            <Stat
              label='Terlambat'
              value={queue.data.late.length}
              tone='warning'
            />
            <Stat label='Di dock' value={queue.data.atDock.length} />
            <Stat label='Belum datang' value={queue.data.upcoming.length} />
          </div>

          <QueueSection
            title='Menunggu dock (terlambat)'
            description='Sudah gate-in melewati masa tenggang. Dahulukan kelompok ini.'
            bookings={queue.data.late}
            docks={availableDocks}
            onAssign={(booking, dock) => setAssignTarget({ booking, dock })}
            onNoShow={setNoShowTarget}
            assigning={assign.isPending}
            assignReset={assignReset}
            highlight
          />

          <QueueSection
            title='Menunggu dock (tepat waktu)'
            description='Sudah gate-in sesuai jadwal dan menunggu dock kosong.'
            bookings={queue.data.onTime}
            docks={availableDocks}
            onAssign={(booking, dock) => setAssignTarget({ booking, dock })}
            onNoShow={setNoShowTarget}
            assigning={assign.isPending}
            assignReset={assignReset}
          />

          <QueueSection
            title='Belum datang'
            description='Booking yang belum dipindai di gate.'
            bookings={queue.data.upcoming}
            onNoShow={setNoShowTarget}
          />
        </>
      )}

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

      <ConfirmDialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (open) return
          setAssignTarget(null)
          setAssignReset((n) => n + 1)
        }}
        title='Tugaskan truk ke dock ini?'
        desc={
          assignTarget ? (
            <div className='space-y-2'>
              <p>
                Truk menempati dock dan checker bisa memulai bongkar/muat dari
                Papan Dock.
              </p>
              <div className='rounded-md border bg-muted/50 p-3 text-xs'>
                <p className='font-mono text-sm font-semibold text-foreground'>
                  {assignTarget.booking.bookingCode}
                </p>
                <p className='mt-1 text-foreground'>
                  {assignTarget.dock.dockCode}
                  {assignTarget.booking.licensePlate
                    ? ` · ${assignTarget.booking.licensePlate}`
                    : ' · plat belum diisi'}
                </p>
                <p className='mt-0.5'>
                  {assignTarget.booking.customer.name} ·{' '}
                  {activityLabels[assignTarget.booking.activityType]}
                </p>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText='Ya, tugaskan'
        cancelBtnText='Batal'
        isLoading={assign.isPending}
        handleConfirm={() =>
          assignTarget &&
          assign.mutate({
            bookingId: assignTarget.booking.id,
            dockId: assignTarget.dock.id,
          })
        }
      />
    </Main>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warning'
}) {
  return (
    <Card>
      <CardContent className='space-y-1'>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <p
          className={
            tone === 'warning'
              ? 'text-3xl font-semibold text-orange-600 tabular-nums dark:text-orange-400'
              : 'text-3xl font-semibold tabular-nums'
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function QueueSection({
  title,
  description,
  bookings,
  docks,
  onAssign,
  onNoShow,
  assigning,
  assignReset,
  highlight,
}: {
  title: string
  description: string
  bookings: Booking[]
  docks?: DockWithBooking[]
  onAssign?: (booking: Booking, dock: DockWithBooking) => void
  onNoShow?: (booking: Booking) => void
  assigning?: boolean
  assignReset?: number
  highlight?: boolean
}) {
  const columns: ColumnDef<Booking>[] = [
    {
      accessorKey: 'bookingCode',
      meta: { label: 'Kode', cellClassName: 'font-mono text-xs' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Kode' />
      ),
    },
    {
      id: 'customer',
      accessorFn: (booking) => booking.customer.name,
      meta: { label: 'Customer', cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Customer' />
      ),
      cell: ({ row }) => (
        <>
          {row.original.customer.name}
          <span className='block text-xs text-muted-foreground'>
            {activityLabels[row.original.activityType]}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'startTime',
      meta: { label: 'Jadwal', cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Jadwal' />
      ),
      cell: ({ row }) => (
        <>
          {formatTime(row.original.startTime)}–
          {formatTime(row.original.endTime)}
          {row.original.lateMinutes > 0 && (
            <span className='ms-1 text-xs text-orange-600'>
              +{row.original.lateMinutes}m
            </span>
          )}
        </>
      ),
    },
    {
      id: 'vehicle',
      accessorFn: (booking) => booking.licensePlate ?? '',
      meta: { label: 'Kendaraan', cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Kendaraan' />
      ),
      cell: ({ row }) => (
        <>
          {row.original.licensePlate ?? '-'}
          {row.original.driverName && (
            <span className='block text-xs text-muted-foreground'>
              {row.original.driverName}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'status',
      accessorFn: (booking) => booking.status,
      enableGlobalFilter: false,
      meta: { label: 'Status' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col items-start gap-1'>
          <StatusBadge status={row.original.status} />
          <ApprovalBadge status={row.original.approvalStatus} />
        </div>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: 'Aksi',
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      header: () => <span>Aksi</span>,
      cell: ({ row }) => {
        const booking = row.original
        const compatible = (docks ?? []).filter(
          (dock) =>
            dock.allowedActivity === 'BOTH' ||
            dock.allowedActivity === booking.activityType
        )

        return (
          <div className='flex items-center justify-end gap-2'>
            {booking.approvalStatus === 'PENDING' && (
              <span className='text-xs text-muted-foreground'>
                Menunggu persetujuan
              </span>
            )}
            {onAssign &&
              booking.approvalStatus !== 'PENDING' &&
              (compatible.length > 0 ? (
                <DockPicker
                  // Pilihan ditahan secara internal, jadi setelah dialog
                  // dibatalkan komponen ini di-remount lewat key agar kembali
                  // ke placeholder. Tanpa ini pilihan yang batal tetap terlihat
                  // dan petugas bisa mengira truk sudah punya dock.
                  key={`${booking.id}-${assignReset}`}
                  docks={compatible}
                  disabled={assigning}
                  label={`Pilih dock untuk ${booking.bookingCode}`}
                  onSelect={(dock) => onAssign(booking, dock)}
                />
              ) : (
                <span className='text-xs text-muted-foreground'>
                  Tidak ada dock
                </span>
              ))}
            {onNoShow && (
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={() => onNoShow(booking)}
              >
                No-show
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <Card
      className={
        highlight && bookings.length > 0 ? 'border-orange-300/70' : undefined
      }
    >
      <CardHeader>
        <CardTitle className='text-base'>
          {title}{' '}
          <Badge variant='outline' className='ms-1 align-middle'>
            {bookings.length}
          </Badge>
        </CardTitle>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className='py-6 text-center text-sm text-muted-foreground'>
            Kosong.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={bookings}
            getRowId={(booking) => booking.id}
            emptyMessage='Kosong.'
          />
        )}
      </CardContent>
    </Card>
  )
}
