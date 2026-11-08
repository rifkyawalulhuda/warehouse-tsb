import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, LogIn, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { gateIn, gateOut, scanQr } from '@/lib/api/endpoints'
import type { ScanResult } from '@/lib/api/types'
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
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { QrScanner } from './qr-scanner'

export function ScanPage() {
  useRealtimeSync()
  const queryClient = useQueryClient()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  /**
   * Aksi gate yang menunggu konfirmasi. Tiket hasil pindai mudah tertukar saat
   * antrean ramai, dan gate-out menutup tiket secara permanen — jadi aksi baru
   * dikirim setelah petugas memastikan kode tiket di layar memang tiket truk
   * yang sedang di depannya.
   */
  const [confirm, setConfirm] = useState<'gate-in' | 'gate-out' | null>(null)

  const scan = useMutation({
    mutationFn: (token: string) => scanQr(token),
    onSuccess: (data) => setResult(data),
    onError: (error) => toast.error(apiErrorMessage(error)),
  })
  const scanMutate = scan.mutate

  const onScan = useCallback(
    (token: string) => {
      setScanning(true)
      scanMutate(token, { onSettled: () => setScanning(false) })
    },
    [scanMutate]
  )

  const refresh = (token: string) => {
    void queryClient.invalidateQueries({ queryKey: ['ops'] })
    void scanQr(token).then(setResult).catch(() => setResult(null))
  }

  const doGateIn = useMutation({
    mutationFn: (token: string) => gateIn(token),
    onSuccess: (booking) => {
      toast.success('Gate-in berhasil')
      setConfirm(null)
      refresh(booking.qrToken)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const doGateOut = useMutation({
    mutationFn: (token: string) => gateOut(token),
    onSuccess: (booking) => {
      toast.success('Gate-out berhasil')
      setConfirm(null)
      refresh(booking.qrToken)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const busy = doGateIn.isPending || doGateOut.isPending

  return (
    <Main className='mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6'>
      <PageHeader
        title='Gate'
        description='Pindai QR tiket truk untuk check-in dan check-out.'
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Pindai tiket</CardTitle>
          <CardDescription>
            {scanning ? 'Memeriksa tiket...' : 'Arahkan kamera ke QR, atau isi kode manual.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QrScanner onScan={onScan} />
        </CardContent>
      </Card>

      {result && (
        <Card
          className={
            result.canGateIn
              ? 'border-emerald-300/70'
              : result.booking.status === 'COMPLETED'
                ? 'border-teal-300/70'
                : 'border-amber-300/70'
          }
        >
          <CardHeader>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <CardTitle className='font-mono text-base'>
                {result.booking.bookingCode}
              </CardTitle>
              <StatusBadge status={result.booking.status} />
            </div>
            <CardDescription>
              {result.booking.customer.name}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <dl className='grid gap-3 text-sm sm:grid-cols-2'>
              <Row label='Aktivitas'>{activityLabels[result.booking.activityType]}</Row>
              <Row label='Jenis truk'>
                {result.booking.truckType.truckName} (
                {durationLabel(bookingDurationMinutes(result.booking))})
              </Row>
              <Row label='Jadwal'>
                {formatDate(result.booking.bookingDate)} ·{' '}
                {formatTime(result.booking.startTime)}–
                {formatTime(result.booking.endTime)}
              </Row>
              <Row label='Dokumen'>{result.booking.referenceDocNo}</Row>
              <Row label='Plat nomor'>{result.booking.licensePlate ?? 'Belum diisi'}</Row>
              <Row label='Supir'>{result.booking.driverName ?? 'Belum diisi'}</Row>
              <Row label='Dock'>{result.booking.assignedDock?.dockCode ?? '-'}</Row>
              <Row label='Masa tenggang'>
                {result.gracePeriodMinutes} menit
              </Row>
            </dl>

            {result.earlyArrival && (
              <Notice
                tone='warning'
                icon={AlertTriangle}
                title='Datang terlalu awal'
                body={result.earlyArrival.message}
              />
            )}

            {result.approvalPending && (
              <Notice
                tone='warning'
                icon={AlertTriangle}
                title='Menunggu persetujuan Admin'
                body='Booking ini belum disetujui Admin gudang, jadi truk belum boleh masuk.'
              />
            )}

            {result.vehicleIncomplete && (
              <Notice
                tone='warning'
                icon={AlertTriangle}
                title='Data kendaraan belum lengkap'
                body='Plat nomor dan nama supir wajib diisi sebelum gate-in.'
              />
            )}

            {!result.earlyArrival &&
              !result.vehicleIncomplete &&
              !result.approvalPending &&
              result.canGateIn && (
              <Notice
                tone={
                  result.projectedStatus === 'LATE_WAITING_LIST' ? 'warning' : 'success'
                }
                icon={CheckCircle2}
                title={
                  result.projectedStatus === 'LATE_WAITING_LIST'
                    ? 'Terlambat — masuk antrean'
                    : 'Tepat waktu'
                }
                body={
                  result.projectedStatus === 'LATE_WAITING_LIST'
                    ? `Terlambat ${result.lateMinutes} menit. Truk akan masuk waiting list sampai dock kosong.`
                    : 'Truk boleh masuk dan menunggu penugasan dock.'
                }
              />
            )}

            <div className='flex flex-wrap gap-2'>
              {result.canGateIn && (
                <Button disabled={busy} onClick={() => setConfirm('gate-in')}>
                  <LogIn /> Gate-In
                </Button>
              )}
              {result.booking.status === 'COMPLETED' && (
                <Button disabled={busy} onClick={() => setConfirm('gate-out')}>
                  <LogOut /> Gate-Out
                </Button>
              )}
              {result.booking.status === 'CHECKED_OUT' && (
                <p className='text-sm text-muted-foreground'>
                  Tiket sudah selesai dipakai.
                </p>
              )}
              <Button
                variant='ghost'
                onClick={() => setResult(null)}
              >
                <ArrowRightLeft /> Pindai tiket lain
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm === 'gate-in' ? 'Konfirmasi gate-in?' : 'Konfirmasi gate-out?'
        }
        desc={
          result ? (
            <div className='space-y-2'>
              <p>
                {confirm === 'gate-in'
                  ? result.projectedStatus === 'LATE_WAITING_LIST'
                    ? 'Waktu masuk dicatat, dan karena sudah melewati masa tenggang truk masuk waiting list sampai ada dock kosong.'
                    : 'Waktu masuk dicatat dan truk masuk daftar tunggu dock.'
                  : 'Tiket ditutup dan slotnya dilepas. Tindakan ini tidak bisa dibatalkan.'}
              </p>
              <div className='rounded-md border bg-muted/50 p-3 text-xs'>
                <p className='font-mono text-sm font-semibold text-foreground'>
                  {result.booking.bookingCode}
                </p>
                <p className='mt-1 text-foreground'>
                  {result.booking.licensePlate ?? 'Plat belum diisi'}
                  {result.booking.driverName
                    ? ` · ${result.booking.driverName}`
                    : ''}
                </p>
                <p className='mt-0.5'>
                  {result.booking.customer.name} ·{' '}
                  {activityLabels[result.booking.activityType]} ·{' '}
                  {formatTime(result.booking.startTime)}–
                  {formatTime(result.booking.endTime)}
                </p>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText={confirm === 'gate-in' ? 'Ya, gate-in' : 'Ya, gate-out'}
        cancelBtnText='Batal'
        isLoading={busy}
        handleConfirm={() => {
          if (!result) return
          if (confirm === 'gate-in') doGateIn.mutate(result.booking.qrToken)
          else doGateOut.mutate(result.booking.qrToken)
        }}
      />
    </Main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-0.5'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='font-medium'>{children}</dd>
    </div>
  )
}

function Notice({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: 'success' | 'warning'
  icon: React.ElementType
  title: string
  body: string
}) {
  return (
    <div
      className={
        tone === 'success'
          ? 'flex gap-3 rounded-lg border border-emerald-300/70 bg-emerald-50 p-3 text-sm dark:border-emerald-800/60 dark:bg-emerald-950/40'
          : 'flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/40'
      }
    >
      <Icon className='mt-0.5 size-4 shrink-0' />
      <div className='space-y-0.5'>
        <p className='font-medium'>{title}</p>
        <p className='text-muted-foreground'>{body}</p>
      </div>
    </div>
  )
}
