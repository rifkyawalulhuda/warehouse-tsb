import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, RowSelectionState } from '@tanstack/react-table'
import { AlarmClock, Check, Copy, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  approveBooking,
  batchApproveBookings,
  fetchApprovals,
  rejectBooking,
} from '@/lib/api/endpoints'
import type { Booking } from '@/lib/api/types'
import { buildApprovalMessage } from '@/lib/approval-message'
import { activityLabels, formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { useNow } from '@/hooks/use-now'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalBadge } from '@/components/approval-badge'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'

/**
 * Antrean persetujuan booking.
 *
 * Diurutkan menurut tenggat, bukan jam kedatangan: yang paling dekat
 * kedaluwarsa adalah yang paling mendesak diputuskan.
 *
 * Dipasang sebagai tab di Antrean Hari Ini (keputusan grilling 3.10), bukan
 * menu sidebar terpisah — Admin sudah membuka layar ini setiap pagi.
 */
export function ApprovalsPanel() {
  useRealtimeSync()
  const t = useT()
  const queryClient = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null)
  const [selected, setSelected] = useState<RowSelectionState>({})

  const approvals = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => fetchApprovals({ status: 'PENDING' }),
  })

  const approve = useMutation({
    mutationFn: (id: string) => approveBooking(id),
    onSuccess: (booking) => {
      toast.success(
        t('approvals.approvedToast', { code: booking.bookingCode })
      )
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const batch = useMutation({
    mutationFn: (ids: string[]) => batchApproveBookings(ids),
    onSuccess: (result) => {
      const skipped = result.skipped.length
      toast.success(
        skipped === 0
          ? t('approvals.batchApproved', { count: result.approved.length })
          : t('approvals.batchApprovedSkipped', {
              approved: result.approved.length,
              skipped,
            })
      )
      setSelected({})
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const bookings = approvals.data?.bookings ?? []

  const columns: ColumnDef<Booking>[] = [
    {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      meta: { label: t('approvals.col.select'), headerClassName: 'w-10' },
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('approvals.selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('approvals.selectRow', {
            code: row.original.bookingCode,
          })}
        />
      ),
    },
    {
      accessorKey: 'bookingCode',
      meta: {
        label: t('approvals.col.code'),
        cellClassName: 'font-mono text-xs',
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('approvals.col.code')}
        />
      ),
    },
    {
      id: 'customer',
      accessorFn: (booking) => booking.customer.name,
      meta: { label: t('approvals.col.customer'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('approvals.col.customer')}
        />
      ),
      cell: ({ row }) => (
        <>
          {row.original.customer.name}
          <span className='block text-xs text-muted-foreground'>
            {activityLabels[row.original.activityType]} ·{' '}
            {row.original.truckType.truckName}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'startTime',
      meta: { label: t('approvals.col.schedule'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('approvals.col.schedule')}
        />
      ),
      cell: ({ row }) => (
        <>
          {formatTime(row.original.startTime)}–
          {formatTime(row.original.endTime)}
          <span className='block text-xs text-muted-foreground'>
            {row.original.bookingDate}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'approvalDeadline',
      meta: { label: t('approvals.col.deadline'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('approvals.col.deadline')}
        />
      ),
      cell: ({ row }) => <DeadlineCell iso={row.original.approvalDeadline} />,
    },
    {
      id: 'status',
      accessorFn: (booking) => booking.approvalStatus,
      enableGlobalFilter: false,
      meta: { label: t('approvals.col.status') },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('approvals.col.status')}
        />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col items-start gap-1'>
          <ApprovalBadge status={row.original.approvalStatus} />
          {!(row.original.licensePlate && row.original.driverName) && (
            <span className='text-[11px] text-amber-600 dark:text-amber-400'>
              {t('approvals.vehicleIncomplete')}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: t('approvals.col.actions'),
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      header: () => <span>{t('approvals.col.actions')}</span>,
      cell: ({ row }) => {
        const booking = row.original
        return (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='sm'
              title={t('approvals.copyMessage')}
              onClick={() => void copyApprovalMessage(booking, t)}
            >
              <Copy />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-rose-600'
              onClick={() => setRejectTarget(booking)}
            >
              <X />
              {t('approvals.reject')}
            </Button>
            <Button
              size='sm'
              disabled={approve.isPending}
              onClick={() => approve.mutate(booking.id)}
            >
              <Check />
              {t('approvals.approve')}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className='flex flex-col gap-4'>
      <p className='text-sm text-muted-foreground'>
        {t('approvals.note')}
      </p>

      {approvals.isPending ? (
        <LoadingBlock label={t('approvals.loading')} />
      ) : approvals.isError ? (
        <ErrorBlock
          error={approvals.error}
          onRetry={() => void approvals.refetch()}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {t('approvals.cardTitle')}{' '}
              <Badge variant='outline' className='ms-1 align-middle'>
                {bookings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={bookings}
              getRowId={(booking) => booking.id}
              rowSelection={selected}
              onRowSelectionChange={setSelected}
              pageSize={20}
              searchPlaceholder={t('approvals.searchPlaceholder')}
              emptyMessage={t('approvals.empty')}
              renderBulkActions={(ids) => (
                <Button
                  size='sm'
                  disabled={batch.isPending}
                  onClick={() => batch.mutate(ids)}
                >
                  {batch.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Check />
                  )}
                  {t('approvals.approveSelected', { count: ids.length })}
                </Button>
              )}
            />
          </CardContent>
        </Card>
      )}

      <RejectDialog
        booking={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null)
          void queryClient.invalidateQueries({ queryKey: ['approvals'] })
          void queryClient.invalidateQueries({ queryKey: ['ops'] })
        }}
      />
    </div>
  )
}

async function copyApprovalMessage(
  booking: Booking,
  t: ReturnType<typeof useT>
) {
  const text = buildApprovalMessage(
    {
      bookingCode: booking.bookingCode,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      referenceDocNo: booking.referenceDocNo,
    },
    { kind: 'pending' }
  )
  try {
    await navigator.clipboard.writeText(text)
    toast.success(t('approvals.copied'))
  } catch {
    toast.error(t('approvals.copyDenied'))
  }
}

/**
 * Dipisah jadi komponen karena `useDeadlineLabel` memakai hook: hook tidak
 * boleh dipanggil langsung dari fungsi sel.
 */
function DeadlineCell({ iso }: { iso: string | null }) {
  const t = useT()
  const deadline = useDeadlineLabel(iso)
  const urgent = deadline?.urgent ?? false

  return (
    <>
      {deadline ? (
        <span
          className={
            urgent
              ? 'flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400'
              : 'flex items-center gap-1 text-muted-foreground'
          }
        >
          <AlarmClock className='size-3.5' />
          {deadline.label}
        </span>
      ) : (
        <span className='text-xs text-muted-foreground'>-</span>
      )}
      {urgent && (
        <Badge variant='outline' className='mt-1 text-[10px]'>
          {t('approvals.urgent')}
        </Badge>
      )}
    </>
  )
}

/**
 * Label tenggat dalam bahasa manusia. `urgent` dipakai untuk badge, bukan untuk
 * keputusan: sesuai rencana §4.2, buffer hanya memengaruhi tampilan.
 */
function useDeadlineLabel(iso: string | null): {
  label: string
  urgent: boolean
} | null {
  const t = useT()
  const now = useNow(30_000, iso !== null)
  return useMemo(() => {
    if (!iso) return null
    const target = new Date(iso)
    const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60_000)

    if (diffMinutes < 0) {
      return { label: t('approvals.deadlineOverdue'), urgent: true }
    }
    if (diffMinutes < 60) {
      return {
        label: t('approvals.deadlineMinutes', { count: diffMinutes }),
        urgent: true,
      }
    }
    if (diffMinutes < 24 * 60) {
      const hours = Math.round(diffMinutes / 60)
      return {
        label: t('approvals.deadlineHours', { count: hours }),
        urgent: hours <= 3,
      }
    }
    const days = Math.round(diffMinutes / (24 * 60))
    return {
      label: t('approvals.deadlineDays', { count: days }),
      urgent: false,
    }
  }, [iso, t, now])
}

function RejectDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking | null
  onClose: () => void
  onDone: () => void
}) {
  const t = useT()
  const [reason, setReason] = useState('')

  const reject = useMutation({
    mutationFn: () => rejectBooking(booking!.id, reason.trim()),
    onSuccess: () => {
      toast.success(t('approvals.rejectedToast'))
      setReason('')
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const valid = reason.trim().length >= 5

  return (
    <Dialog
      open={booking !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
    >
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {t('approvals.rejectTitle', { code: booking?.bookingCode ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('approvals.rejectDesc')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-1'>
          <Label htmlFor='reject-reason'>{t('approvals.rejectReason')}</Label>
          <Textarea
            id='reject-reason'
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('approvals.rejectReasonPlaceholder')}
          />
          <p className='text-xs text-muted-foreground'>
            {t('approvals.rejectReasonHint')}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              setReason('')
              onClose()
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant='destructive'
            disabled={!valid || reject.isPending}
            onClick={() => reject.mutate()}
          >
            {reject.isPending && <Loader2 className='animate-spin' />}
            {t('approvals.rejectConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
