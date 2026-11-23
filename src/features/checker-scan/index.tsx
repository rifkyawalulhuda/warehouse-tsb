import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  PlayCircle,
  QrCode,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  assignDock,
  fetchCheckerScan,
  finishProcess,
  startProcess,
} from '@/lib/api/endpoints'
import type { CheckerScanResult } from '@/lib/api/types'
import { activityLabels, formatDate, formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { dockOptionLabel, dockOptionPlace, dockWithArea } from '@/lib/dock-label'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { QrScanner } from '@/features/scanner/qr-scanner'

type PendingAction = 'assign' | 'start' | 'finish'
type Translate = ReturnType<typeof useT>

/**
 * Pindai di sisi checker: satu pindai langsung membawa checker ke truk yang
 * sedang di depannya, tanpa mencari kartu di Papan Dock. Aksi yang tersedia
 * mengikuti status truk — menugaskan dock, memulai, atau menyelesaikan proses.
 */
export function CheckerScanPage() {
  useRealtimeSync()
  const t = useT()
  const queryClient = useQueryClient()

  const [token, setToken] = useState<string | null>(null)
  const [result, setResult] = useState<CheckerScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [dockId, setDockId] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['ops'] })
    void queryClient.invalidateQueries({ queryKey: ['bookings'] })
  }

  /** Kembali ke mode pindai: checker berikutnya langsung bisa memindai. */
  const reset = () => {
    setResult(null)
    setToken(null)
    setDockId(null)
    setPending(null)
  }

  /**
   * Setelah aksi gagal, layar tidak boleh menampilkan keadaan lama yang sudah
   * tidak benar — misalnya dock yang baru saja dipakai truk lain.
   */
  const refreshResult = useCallback(async (qrToken: string) => {
    try {
      setResult(await fetchCheckerScan(qrToken))
    } catch {
      setResult(null)
      setToken(null)
      setDockId(null)
      setPending(null)
    }
  }, [])

  const scan = useMutation({
    mutationFn: (qrToken: string) => fetchCheckerScan(qrToken),
    onSuccess: (data) => {
      setResult(data)
      setDockId(null)
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error))
      reset()
    },
  })
  const scanMutate = scan.mutate

  const onScan = useCallback(
    (qrToken: string) => {
      setToken(qrToken)
      setScanning(true)
      scanMutate(qrToken, { onSettled: () => setScanning(false) })
    },
    [scanMutate]
  )

  /**
   * Menugaskan dock lalu langsung memulai proses: truk yang baru dipindai
   * memang sudah berdiri di dock, jadi dua klik terpisah hanya memperlambat.
   */
  const assignAndStart = useMutation({
    mutationFn: async (input: { bookingId: string; dockId: number }) => {
      await assignDock(input.bookingId, input.dockId)
      return startProcess(input.bookingId)
    },
    onSuccess: () => {
      toast.success(t('ops.checker.assignedAndStarted'))
      invalidate()
      reset()
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error))
      invalidate()
      if (token) void refreshResult(token)
    },
  })

  const start = useMutation({
    mutationFn: (bookingId: string) => startProcess(bookingId),
    onSuccess: () => {
      toast.success(t('ops.checker.started'))
      invalidate()
      reset()
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error))
      if (token) void refreshResult(token)
    },
  })

  const finish = useMutation({
    mutationFn: (bookingId: string) => finishProcess(bookingId),
    onSuccess: () => {
      toast.success(t('ops.checker.finished'))
      invalidate()
      reset()
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error))
      if (token) void refreshResult(token)
    },
  })

  const busy = assignAndStart.isPending || start.isPending || finish.isPending
  const eligibleDocks = result?.docks.filter((dock) => dock.eligible) ?? []
  const blockedDocks = result?.docks.filter((dock) => !dock.eligible) ?? []
  const chosenDock = eligibleDocks.find((dock) => dock.id === dockId)

  return (
    <Main className='mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6'>
      <PageHeader
        title={t('ops.checker.title')}
        description={t('ops.checker.description')}
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>{t('ops.scanTitle')}</CardTitle>
          <CardDescription>
            {scanning ? t('ops.scanChecking') : t('ops.scanHint')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QrScanner onScan={onScan} />
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <CardTitle className='font-mono text-base'>
                {result.booking.bookingCode}
              </CardTitle>
              <StatusBadge status={result.booking.status} />
            </div>
            <CardDescription>{result.booking.customer.name}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <dl className='grid gap-3 text-sm sm:grid-cols-2'>
              <Row label={t('ops.field.activity')}>
                {activityLabels[result.booking.activityType]}
              </Row>
              <Row label={t('ops.field.schedule')}>
                {formatDate(result.booking.bookingDate)} ·{' '}
                {formatTime(result.booking.startTime)}–
                {formatTime(result.booking.endTime)}
              </Row>
              <Row label={t('ops.field.plate')}>
                {result.booking.licensePlate ?? t('ops.notFilled')}
              </Row>
              <Row label={t('ops.field.driver')}>
                {result.booking.driverName ?? t('ops.notFilled')}
              </Row>
              <Row label={t('ops.field.dock')}>
                {result.booking.assignedDock
                  ? dockWithArea(result.booking.assignedDock)
                  : t('ops.dockUnassigned')}
              </Row>
              <Row label={t('ops.field.gateInAt')}>
                {result.booking.timeLog?.gateInAt
                  ? formatTime(result.booking.timeLog.gateInAt)
                  : t('ops.notGatedIn')}
              </Row>
              {result.waitingPosition !== null && (
                <Row label={t('ops.field.waitPosition')}>
                  {t('ops.waitPosition', { position: result.waitingPosition })}
                </Row>
              )}
            </dl>

            {result.actions.assignDock && (
              <div className='space-y-3'>
                <div className='space-y-1'>
                  <p className='text-sm font-medium'>
                    {t('ops.checker.pickDock')}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {t('ops.checker.pickDockHint', {
                      activity:
                        activityLabels[
                          result.booking.activityType
                        ].toLowerCase(),
                    })}
                  </p>
                </div>

                {eligibleDocks.length === 0 ? (
                  <Notice
                    tone='warning'
                    icon={AlertTriangle}
                    title={t('ops.checker.noDockTitle')}
                    body={t('ops.checker.noDockBody', {
                      activity:
                        activityLabels[
                          result.booking.activityType
                        ].toLowerCase(),
                    })}
                  />
                ) : (
                  <RadioGroup
                    value={dockId === null ? '' : String(dockId)}
                    onValueChange={(value) => setDockId(Number(value))}
                    className='grid grid-cols-2 gap-2 sm:grid-cols-3'
                  >
                    {eligibleDocks.map((dock) => (
                      <Label
                        key={dock.id}
                        className={cn(
                          'flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm font-medium',
                          'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5'
                        )}
                      >
                        <RadioGroupItem
                          value={String(dock.id)}
                          aria-label={dockOptionLabel(dock)}
                          className='mt-0.5'
                        />
                        <span className='flex min-w-0 flex-col'>
                          <span className='truncate'>{dock.dockCode}</span>
                          {dockOptionPlace(dock) && (
                            <span className='truncate text-xs font-normal text-muted-foreground'>
                              {dockOptionPlace(dock)}
                            </span>
                          )}
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                )}

                {blockedDocks.length > 0 && (
                  <p className='text-xs text-muted-foreground'>
                    {t('ops.checker.blocked', {
                      list: blockedDocks
                        .map(
                          (dock) =>
                            `${dock.dockCode} (${
                              dock.currentStatus === 'MAINTENANCE'
                                ? t('ops.checker.blockedMaintenance')
                                : dock.currentStatus === 'OCCUPIED'
                                  ? t('ops.checker.blockedOccupied')
                                  : t('ops.checker.blockedOtherActivity')
                            })`
                        )
                        .join(' · '),
                    })}
                  </p>
                )}

                <div className='flex flex-wrap gap-2'>
                  <Button
                    disabled={busy || chosenDock === undefined}
                    onClick={() => setPending('assign')}
                  >
                    <PlayCircle /> {t('ops.checker.assignAndStart')}
                  </Button>
                  <Button variant='ghost' onClick={reset}>
                    <ArrowRightLeft /> {t('ops.scanAnother')}
                  </Button>
                </div>
              </div>
            )}

            {result.actions.start && (
              <div className='space-y-3'>
                <Notice
                  tone='success'
                  icon={CheckCircle2}
                  title={t('ops.checker.assignedTo', {
                    dock: result.booking.assignedDock?.dockCode ?? 'dock',
                  })}
                  body={t('ops.checker.startBody')}
                />
                <div className='flex flex-wrap gap-2'>
                  <Button disabled={busy} onClick={() => setPending('start')}>
                    <PlayCircle /> {t('ops.checker.start')}
                  </Button>
                  <Button variant='ghost' onClick={reset}>
                    <ArrowRightLeft /> {t('ops.scanAnother')}
                  </Button>
                </div>
              </div>
            )}

            {result.actions.finish && (
              <div className='space-y-3'>
                <Notice
                  tone='success'
                  icon={CheckCircle2}
                  title={t('ops.checker.inProgressAt', {
                    dock: result.booking.assignedDock?.dockCode ?? 'dock',
                  })}
                  body={
                    result.booking.timeLog?.processStartedAt
                      ? t('ops.checker.startedAt', {
                          time: formatTime(
                            result.booking.timeLog.processStartedAt
                          ),
                        })
                      : t('ops.checker.finishBody')
                  }
                />
                <div className='flex flex-wrap gap-2'>
                  <Button disabled={busy} onClick={() => setPending('finish')}>
                    <CheckCircle2 /> {t('ops.checker.finish')}
                  </Button>
                  <Button variant='ghost' onClick={reset}>
                    <ArrowRightLeft /> {t('ops.scanAnother')}
                  </Button>
                </div>
              </div>
            )}

            {!result.actions.assignDock &&
              !result.actions.start &&
              !result.actions.finish && (
                <div className='space-y-3'>
                  <Notice
                    tone='warning'
                    icon={QrCode}
                    title={inactiveTitle(result, t)}
                    body={inactiveBody(result, t)}
                  />
                  <Button variant='ghost' onClick={reset}>
                    <ArrowRightLeft /> {t('ops.scanAnother')}
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending === 'assign'
            ? t('ops.checker.confirmAssignTitle')
            : pending === 'start'
              ? t('ops.checker.confirmStartTitle')
              : t('ops.checker.confirmFinishTitle')
        }
        desc={
          result ? (
            <div className='space-y-2'>
              <p>
                {pending === 'assign'
                  ? t('ops.checker.confirmAssignBody', {
                      dock: chosenDock
                        ? dockWithArea(chosenDock)
                        : t('ops.field.dock'),
                    })
                  : pending === 'start'
                    ? t('ops.checker.confirmStartBody')
                    : t('ops.checker.confirmFinishBody')}
              </p>
              <div className='rounded-md border bg-muted/50 p-3 text-xs'>
                <p className='font-mono text-sm font-semibold text-foreground'>
                  {result.booking.bookingCode}
                </p>
                <p className='mt-1 text-foreground'>
                  {pending === 'assign'
                    ? chosenDock && dockWithArea(chosenDock)
                    : result.booking.assignedDock &&
                      dockWithArea(result.booking.assignedDock)}
                  {result.booking.licensePlate
                    ? ` · ${result.booking.licensePlate}`
                    : ` · ${t('ops.checker.plateEmpty')}`}
                </p>
                <p className='mt-0.5'>
                  {result.booking.customer.name} ·{' '}
                  {activityLabels[result.booking.activityType]}
                </p>
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText={
          pending === 'assign'
            ? t('ops.checker.confirmAssign')
            : pending === 'start'
              ? t('ops.checker.confirmStart')
              : t('ops.checker.confirmFinish')
        }
        cancelBtnText={t('common.cancel')}
        isLoading={busy}
        handleConfirm={() => {
          if (!result) return
          if (pending === 'assign' && dockId !== null)
            assignAndStart.mutate({ bookingId: result.booking.id, dockId })
          else if (pending === 'start') start.mutate(result.booking.id)
          else if (pending === 'finish') finish.mutate(result.booking.id)
        }}
      />
    </Main>
  )
}

function inactiveTitle(result: CheckerScanResult, t: Translate) {
  if (result.booking.approvalStatus === 'PENDING')
    return t('ops.checker.inactiveApprovalTitle')
  switch (result.booking.status) {
    case 'BOOKED_INCOMPLETE':
    case 'BOOKED_READY':
      return t('ops.checker.inactiveNotGatedTitle')
    case 'COMPLETED':
      return t('ops.checker.inactiveCompletedTitle')
    case 'CHECKED_OUT':
      return t('ops.checker.inactiveCheckedOutTitle')
    case 'NO_SHOW':
      return t('ops.checker.inactiveNoShowTitle')
    default:
      return t('ops.checker.inactiveDefaultTitle')
  }
}

function inactiveBody(result: CheckerScanResult, t: Translate) {
  if (result.booking.approvalStatus === 'PENDING')
    return t('ops.checker.inactiveApprovalBody')
  switch (result.booking.status) {
    case 'BOOKED_INCOMPLETE':
    case 'BOOKED_READY':
      return t('ops.checker.inactiveNotGatedBody')
    case 'COMPLETED':
      return t('ops.checker.inactiveCompletedBody')
    case 'CHECKED_OUT':
      return t('ops.checker.inactiveCheckedOutBody')
    case 'NO_SHOW':
      return t('ops.checker.inactiveNoShowBody')
    default:
      return t('ops.checker.inactiveDefaultBody')
  }
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
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
