import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { assignDock, fetchOpsDocks, fetchQueue, markNoShow } from '@/lib/api/endpoints'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { useAuthStore } from '@/stores/auth-store'
import { activityLabels, formatTime, todayISO } from '@/lib/format'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { ApprovalBadge } from '@/components/approval-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApprovalsPanel } from '@/features/approvals'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
   * Dinaikkan setiap dialog dock ditutup, supaya `<Select>` per baris kembali
   * ke placeholder. Tanpa ini pilihan yang dibatalkan tetap terlihat, dan
   * petugas bisa mengira truk sudah punya dock padahal belum.
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
    mutationFn: ({ bookingId, dockId }: { bookingId: string; dockId: number }) =>
      assignDock(bookingId, dockId),
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
    () => (docks.data ?? []).filter((dock) => dock.currentStatus === 'AVAILABLE'),
    [docks.data]
  )

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Antrean Hari Ini'
        description='Truk yang menunggu di area staging, dikelompokkan menurut status masuk.'
        actions={
          tab === 'queue' ? (
            <Input
              type='date'
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className='h-9 w-auto'
            />
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'queue' | 'approvals')}>
        <TabsList>
          <TabsTrigger value='queue'>Antrean</TabsTrigger>
          {canApprove && <TabsTrigger value='approvals'>Persetujuan</TabsTrigger>}
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
            <Stat label='Terlambat' value={queue.data.late.length} tone='warning' />
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
              ? 'text-3xl font-semibold tabular-nums text-orange-600 dark:text-orange-400'
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
  return (
    <Card className={highlight && bookings.length > 0 ? 'border-orange-300/70' : undefined}>
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
          <p className='py-6 text-center text-sm text-muted-foreground'>Kosong.</p>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Jadwal</TableHead>
                  <TableHead>Kendaraan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-end'>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => {
                  const compatible = (docks ?? []).filter(
                    (dock) =>
                      dock.allowedActivity === 'BOTH' ||
                      dock.allowedActivity === booking.activityType
                  )

  return (
                    <TableRow key={booking.id}>
                      <TableCell className='font-mono text-xs'>
                        {booking.bookingCode}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {booking.customer.name}
                        <span className='block text-xs text-muted-foreground'>
                          {activityLabels[booking.activityType]}
                        </span>
                      </TableCell>
                      <TableCell className='text-sm'>
                        {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
                        {booking.lateMinutes > 0 && (
                          <span className='ms-1 text-xs text-orange-600'>
                            +{booking.lateMinutes}m
                          </span>
                        )}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {booking.licensePlate ?? '-'}
                        {booking.driverName && (
                          <span className='block text-xs text-muted-foreground'>
                            {booking.driverName}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col items-start gap-1'>
                          <StatusBadge status={booking.status} />
                          <ApprovalBadge status={booking.approvalStatus} />
                        </div>
                      </TableCell>
                      <TableCell className='text-end'>
                        <div className='flex items-center justify-end gap-2'>
                          {booking.approvalStatus === 'PENDING' && (
                            <span className='text-xs text-muted-foreground'>
                              Menunggu persetujuan
                            </span>
                          )}
                          {onAssign &&
                            booking.approvalStatus !== 'PENDING' &&
                            (compatible.length > 0 ? (
                              <Select
                                // Dropdown ini uncontrolled: setelah dialog
                                // dibatalkan, pilihan yang batal tetap tampil
                                // seolah dock sudah dipakai. Ganti key supaya
                                // kembali ke "Pilih dock".
                                key={`${booking.id}-${assignReset}`}
                                disabled={assigning}
                                onValueChange={(value) => {
                                  const dock = compatible.find(
                                    (item) => item.id === Number(value)
                                  )
                                  if (dock) onAssign(booking, dock)
                                }}
                              >
                                <SelectTrigger className='h-8 w-32'>
                                  <SelectValue placeholder='Pilih dock' />
                                </SelectTrigger>
                                <SelectContent>
                                  {compatible.map((dock) => (
                                    <SelectItem key={dock.id} value={String(dock.id)}>
                                      {dock.dockCode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
