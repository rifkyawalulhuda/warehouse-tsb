import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useRealtimeSync } from '@/hooks/use-realtime'
import { activityLabels, formatTime } from '@/lib/format'
import { buildApprovalMessage } from '@/lib/approval-message'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { ApprovalBadge } from '@/components/approval-badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
  const queryClient = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<Booking | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const approvals = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => fetchApprovals({ status: 'PENDING' }),
  })

  const approve = useMutation({
    mutationFn: (id: string) => approveBooking(id),
    onSuccess: (booking) => {
      toast.success(`Booking ${booking.bookingCode} disetujui`)
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
          ? `${result.approved.length} booking disetujui`
          : `${result.approved.length} disetujui, ${skipped} dilewati (sudah diputuskan)`
      )
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ['approvals'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const bookings = approvals.data?.bookings ?? []

  const allSelected = bookings.length > 0 && selected.size === bookings.length
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(bookings.map((b) => b.id)))
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          Booking yang menunggu keputusan Admin. Slot sudah tergenggam sampai tenggat.
        </p>
        {selected.size > 0 && (
          <Button
            size='sm'
            disabled={batch.isPending}
            onClick={() => batch.mutate([...selected])}
          >
            {batch.isPending ? <Loader2 className='animate-spin' /> : <Check />}
            Setujui {selected.size} terpilih
          </Button>
        )}
      </div>

      {approvals.isPending ? (
        <LoadingBlock label='Memuat antrean persetujuan...' />
      ) : approvals.isError ? (
        <ErrorBlock error={approvals.error} onRetry={() => void approvals.refetch()} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              Menunggu persetujuan{' '}
              <Badge variant='outline' className='ms-1 align-middle'>
                {bookings.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>
                Tidak ada booking yang menunggu persetujuan.
              </p>
            ) : (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className='w-10'>
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          aria-label='Pilih semua'
                        />
                      </TableHead>
                      <TableHead>Kode</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Jadwal</TableHead>
                      <TableHead>Tenggat</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-end'>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <ApprovalRow
                        key={booking.id}
                        booking={booking}
                        selected={selected.has(booking.id)}
                        onToggle={() => toggleOne(booking.id)}
                        onApprove={() => approve.mutate(booking.id)}
                        onReject={() => setRejectTarget(booking)}
                        approving={approve.isPending}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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

function ApprovalRow({
  booking,
  selected,
  onToggle,
  onApprove,
  onReject,
  approving,
}: {
  booking: Booking
  selected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
  approving: boolean
}) {
  const deadline = useDeadlineLabel(booking.approvalDeadline)
  const urgent = deadline?.urgent ?? false

  const copyMessage = async () => {
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
      toast.success('Pesan disalin ke papan klip')
    } catch {
      toast.error('Peramban menolak akses papan klip')
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Pilih ${booking.bookingCode}`}
        />
      </TableCell>
      <TableCell className='font-mono text-xs'>{booking.bookingCode}</TableCell>
      <TableCell className='text-sm'>
        {booking.customer.companyName ?? booking.customer.name}
        <span className='block text-xs text-muted-foreground'>
          {activityLabels[booking.activityType]} · {booking.truckType.truckName}
        </span>
      </TableCell>
      <TableCell className='text-sm'>
        {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
        <span className='block text-xs text-muted-foreground'>{booking.bookingDate}</span>
      </TableCell>
      <TableCell className='text-sm'>
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
        {urgent && <Badge variant='outline' className='mt-1 text-[10px]'>MENDESAK</Badge>}
      </TableCell>
      <TableCell>
        <div className='flex flex-col items-start gap-1'>
          <ApprovalBadge status={booking.approvalStatus} />
          {!(booking.licensePlate && booking.driverName) && (
            <span className='text-[11px] text-amber-600 dark:text-amber-400'>
              Data kendaraan belum lengkap
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className='text-end'>
        <div className='flex items-center justify-end gap-1'>
          <Button variant='ghost' size='sm' title='Salin pesan WhatsApp' onClick={copyMessage}>
            <Copy />
          </Button>
          <Button variant='ghost' size='sm' className='text-rose-600' onClick={onReject}>
            <X />
            Tolak
          </Button>
          <Button size='sm' disabled={approving} onClick={onApprove}>
            <Check />
            Setujui
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * Label tenggat dalam bahasa manusia. `urgent` dipakai untuk badge, bukan untuk
 * keputusan: sesuai rencana §4.2, buffer hanya memengaruhi tampilan.
 */
function useDeadlineLabel(iso: string | null) {
  return useMemo(() => {
    if (!iso) return null
    const target = new Date(iso)
    const diffMinutes = Math.round((target.getTime() - Date.now()) / 60_000)

    if (diffMinutes < 0) {
      return { label: 'Sudah lewat tenggat', urgent: true }
    }
    if (diffMinutes < 60) {
      return { label: `${diffMinutes} menit lagi`, urgent: true }
    }
    if (diffMinutes < 24 * 60) {
      const hours = Math.round(diffMinutes / 60)
      return { label: `${hours} jam lagi`, urgent: hours <= 3 }
    }
    const days = Math.round(diffMinutes / (24 * 60))
    return { label: `${days} hari lagi`, urgent: false }
  }, [iso])
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
  const [reason, setReason] = useState('')

  const reject = useMutation({
    mutationFn: () => rejectBooking(booking!.id, reason.trim()),
    onSuccess: () => {
      toast.success('Booking ditolak dan kuota dikembalikan')
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
          <DialogTitle>Tolak booking {booking?.bookingCode}?</DialogTitle>
          <DialogDescription>
            Booking dibatalkan, kuota dikembalikan, dan customer melihat alasan ini.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-1'>
          <Label htmlFor='reject-reason'>Alasan penolakan</Label>
          <Textarea
            id='reject-reason'
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder='Contoh: dokumen DO tidak sesuai dengan barang yang dikirim'
          />
          <p className='text-xs text-muted-foreground'>
            Minimal 5 karakter. Alasan tampil di halaman customer dan tiket supir.
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
            Batal
          </Button>
          <Button
            variant='destructive'
            disabled={!valid || reject.isPending}
            onClick={() => reject.mutate()}
          >
            {reject.isPending && <Loader2 className='animate-spin' />}
            Tolak booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
