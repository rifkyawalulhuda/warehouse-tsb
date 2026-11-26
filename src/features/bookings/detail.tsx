import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  MapPin,
  PencilLine,
  Phone,
  Truck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { cancelBooking, fetchBooking } from '@/lib/api/endpoints'
import type { ApprovalStatus } from '@/lib/api/types'
import { dockWithArea } from '@/lib/dock-label'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { useNow } from '@/hooks/use-now'
import {
  activityLabels,
  bookingDurationMinutes,
  durationLabel,
  formatDate,
  formatTime,
  waNumber,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCanGoBack } from '@/hooks/use-can-go-back'
import { useT } from '@/lib/i18n'
import { useSetPageTitle } from '@/context/page-title-provider'
import { Main } from '@/components/layout/main'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { ApprovalBadge } from '@/components/approval-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { bookingUrgency, dockLabel } from './booking-view'
import { VehicleDialog } from './components/vehicle-dialog'

const CANCELLABLE = ['BOOKED_INCOMPLETE', 'BOOKED_READY']

export function BookingDetail() {
  const { bookingId } = useParams({ from: '/_authenticated/bookings/$bookingId' })
  useRealtimeSync()
  const now = useNow()
  const t = useT()

  // Halaman ini tidak memakai PageHeader (judulnya berupa kode booking), jadi
  // judul bilah atas mobile didaftarkan langsung di sini.
  useSetPageTitle(t('bookings.detail.pageTitle'))

  // Dipakai untuk memutuskan apakah tautan "Kembali ke Jadwal Saya" masih perlu
  // tampil di layar sempit (lihat komentarnya di bawah).
  const canGoBack = useCanGoBack()

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
      toast.success(t('bookings.detail.cancelled'))
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setCancelOpen(false)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  if (isPending) return <LoadingBlock label={t('bookings.detail.loading')} />
  if (isError) return <ErrorBlock error={error} onRetry={() => void refetch()} />

  const booking = data
  const urgency = bookingUrgency(booking, now)
  const isLive = urgency.key === 'in-progress'

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        {/*
          Di layar sempit bilah atas sudah punya tombol kembali, tapi hanya
          kalau tab ini punya riwayat. Halaman detail kerap dibuka langsung
          dari tautan WhatsApp — di sana tombol itu tidak muncul, dan tautan
          inilah satu-satunya jalan pulang. Jadi ia disembunyikan hanya ketika
          tombol kembali di bilah atas benar-benar ada.
        */}
        <Button
          asChild
          variant='ghost'
          size='sm'
          className={cn('-ms-2 text-muted-foreground', canGoBack && 'max-md:hidden')}
        >
          <Link to='/bookings'>
            <ArrowLeft /> {t('bookings.detail.back')}
          </Link>
        </Button>
        <div className='flex flex-wrap items-center gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link to='/t/$token' params={{ token: booking.qrToken }} target='_blank'>
              <ExternalLink /> {t('bookings.detail.openTicket')}
            </Link>
          </Button>
          {booking.status === 'BOOKED_INCOMPLETE' && (
            <Button size='sm' onClick={() => setVehicleOpen(true)}>
              <PencilLine /> {t('bookings.detail.completeVehicle')}
            </Button>
          )}
          {CANCELLABLE.includes(booking.status) && (
            <Button
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={() => setCancelOpen(true)}
            >
              <XCircle /> {t('bookings.detail.cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* Blok utama: waktu, status, dan hal yang harus dilakukan customer. */}
      <section
        aria-labelledby='booking-hero-heading'
        className='relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm sm:p-6'
      >
        <div className='pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-2xl' />
        <div className='relative space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <h1
              id='booking-hero-heading'
              className='font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase'
            >
              {booking.bookingCode}
            </h1>
            <StatusBadge status={booking.status} />
            <ApprovalBadge status={booking.approvalStatus} />
            {isLive && (
              <span className='inline-flex items-center gap-1.5 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300'>
                <span className='size-1.5 animate-pulse rounded-full bg-blue-500' aria-hidden />
                {urgency.label}
              </span>
            )}
          </div>

          <div className='flex flex-wrap items-end gap-x-5 gap-y-2'>
            <p className='text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl'>
              {formatTime(booking.startTime)}
              <span className='ms-1.5 text-lg font-normal text-muted-foreground sm:text-xl'>
                –{formatTime(booking.endTime)}
              </span>
            </p>
            <p className='flex items-center gap-1.5 pb-1 text-sm text-muted-foreground'>
              <CalendarDays className='size-4' aria-hidden />
              {formatDate(booking.bookingDate)}
            </p>
          </div>

          <p className='text-sm text-muted-foreground'>
            {activityLabels[booking.activityType]} · {booking.truckType.truckName} ·{' '}
            {durationLabel(bookingDurationMinutes(booking))} ({t('bookings.detail.blocks', { count: booking.blocksLocked })})
            {urgency.key !== 'in-progress' && urgency.key !== 'overdue' && (
              <> · {urgency.label}</>
            )}
          </p>

          <div className='grid gap-2 border-t pt-4 sm:grid-cols-3'>
            <Fact icon={Truck} label={t('bookings.detail.vehicle')}>
              {booking.licensePlate ?? t('bookings.detail.empty')}
              {booking.driverName && (
                <span className='block text-xs font-normal text-muted-foreground'>
                  {t('bookings.detail.driver')}: {booking.driverName}
                </span>
              )}
            </Fact>
            <Fact icon={MapPin} label={t('bookings.detail.dock')}>
              {dockLabel(booking)}
            </Fact>
            <Fact icon={FileText} label={t('bookings.detail.docNo')}>
              {booking.referenceDocNo}
            </Fact>
          </div>
        </div>
      </section>

      {booking.approvalStatus !== 'NOT_REQUIRED' && (
        <ApprovalNotice
          status={booking.approvalStatus}
          deadline={booking.approvalDeadline}
          approvedAt={booking.approvedAt}
          rejectionReason={booking.rejectionReason}
        />
      )}

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='gap-4 lg:col-span-2'>
          <CardHeader>
            <CardTitle className='text-base'>{t('bookings.detail.detailsTitle')}</CardTitle>
            <CardDescription>{t('bookings.detail.detailsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 sm:grid-cols-2'>
            <Field label={t('bookings.detail.date')}>{formatDate(booking.bookingDate)}</Field>
            <Field label={t('bookings.detail.time')}>
              {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
            </Field>
            <Field label={t('bookings.detail.duration')}>
              {durationLabel(bookingDurationMinutes(booking))} ({t('bookings.detail.blocks', { count: booking.blocksLocked })})
            </Field>
            <Field label={t('bookings.detail.process')}>
              {booking.processName
                ? `${booking.processName} (+${durationLabel(booking.processExtraMinutes)})`
                : t('bookings.detail.empty')}
            </Field>
            <Field label={t('bookings.detail.dock')}>
              {booking.assignedDock
                ? dockWithArea(booking.assignedDock)
                : t('bookings.detail.dockTbd')}
            </Field>
            <Field label={t('bookings.detail.plate')}>
              {booking.licensePlate ?? t('bookings.detail.empty')}
            </Field>
            <Field label={t('bookings.detail.driver')}>
              {booking.driverName ?? t('bookings.detail.empty')}
            </Field>
            <Field label={t('bookings.detail.driverPhone')}>
              {booking.driverPhone ? (
                <span className='inline-flex items-center gap-1.5'>
                  <Phone className='size-3.5 text-muted-foreground' aria-hidden />
                  {booking.driverPhone}
                  <a
                    className='text-primary underline-offset-2 hover:underline'
                    href={`https://wa.me/${waNumber(booking.driverPhone)}`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    WA
                  </a>
                </span>
              ) : (
                '-'
              )}
            </Field>
            <Field label={t('bookings.detail.docNo')}>{booking.referenceDocNo}</Field>
            {booking.lateMinutes > 0 && (
              <Field label={t('bookings.detail.late')}>
                <span className='text-orange-700 dark:text-orange-300'>
                  {t('bookings.detail.minutes', { count: booking.lateMinutes })}
                </span>
              </Field>
            )}
          </CardContent>
        </Card>

        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-base'>{t('bookings.detail.historyTitle')}</CardTitle>
            <CardDescription>{t('bookings.detail.historyDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className='space-y-0'>
              <Timeline label={t('bookings.detail.vehicleComplete')} value={booking.timeLog?.vehicleCompletedAt} />
              <Timeline label={t('bookings.detail.gateIn')} value={booking.timeLog?.gateInAt} />
              <Timeline label={t('bookings.detail.dockAssigned')} value={booking.timeLog?.dockAssignedAt} />
              <Timeline label={t('bookings.detail.processStart')} value={booking.timeLog?.processStartedAt} />
              <Timeline label={t('bookings.detail.processDone')} value={booking.timeLog?.processCompletedAt} />
              <Timeline label={t('bookings.detail.gateOut')} value={booking.timeLog?.gateOutAt} last />
            </ol>
          </CardContent>
        </Card>
      </div>

      <VehicleDialog booking={booking} open={vehicleOpen} onOpenChange={setVehicleOpen} />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={t('bookings.detail.cancelTitle')}
        desc={t('bookings.detail.cancelBody', { code: booking.bookingCode })}
        confirmText={t('bookings.detail.cancelConfirm')}
        destructive
        isLoading={cancel.isPending}
        handleConfirm={() => cancel.mutate()}
      />
    </Main>
  )
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex min-w-0 items-start gap-2'>
      <Icon className='mt-0.5 size-4 shrink-0 text-muted-foreground' aria-hidden />
      <div className='min-w-0'>
        <p className='text-[11px] tracking-wide text-muted-foreground uppercase'>{label}</p>
        <p className='truncate text-sm font-medium'>{children}</p>
      </div>
    </div>
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

/**
 * Timeline vertikal dengan penanda terisi/kosong, supaya customer melihat
 * sejauh mana truknya sudah bergerak tanpa membaca ulang setiap baris.
 */
function Timeline({
  label,
  value,
  last,
}: {
  label: string
  value: string | null | undefined
  last?: boolean
}) {
  const done = Boolean(value)
  return (
    <li className='flex gap-3'>
      <div className='flex flex-col items-center'>
        {done ? (
          <CheckCircle2 className='size-4 text-emerald-600 dark:text-emerald-400' aria-hidden />
        ) : (
          <Circle className='size-4 text-muted-foreground/40' aria-hidden />
        )}
        {!last && <span className='my-0.5 w-px flex-1 bg-border' aria-hidden />}
      </div>
      <div className={cn('flex min-w-0 flex-1 items-center justify-between gap-3', !last && 'pb-3')}>
        <span className={cn('text-sm', !done && 'text-muted-foreground')}>{label}</span>
        <span
          className={cn(
            'shrink-0 text-sm tabular-nums',
            done ? 'font-medium' : 'text-muted-foreground'
          )}
        >
          {value ? formatTime(value) : '-'}
        </span>
      </div>
    </li>
  )
}

function ApprovalNotice({
  status,
  deadline,
  approvedAt,
  rejectionReason,
}: {
  status: ApprovalStatus
  deadline: string | null
  approvedAt: string | null
  rejectionReason: string | null
}) {
  const t = useT()
  const tone =
    status === 'PENDING'
      ? 'border-amber-300/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/25'
      : status === 'APPROVED'
        ? 'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/25'
        : 'border-border bg-muted/40'

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', tone)}>
      <ApprovalBadge status={status} />
      <p className='text-sm text-muted-foreground'>
        {status === 'PENDING' && (
          <>
            {t('bookings.detail.approvalPending')}
            {deadline && (
              <>
                {' '}
                {t('bookings.detail.approvalDeadline', {
                  date: formatDate(deadline.slice(0, 10)),
                  time: formatTime(deadline),
                })}
              </>
            )}{' '}
            {t('bookings.detail.approvalQrInactive')}
          </>
        )}
        {status === 'APPROVED' && (
          <>
            {approvedAt
              ? t('bookings.detail.approvalApprovedAt', { time: formatTime(approvedAt) })
              : t('bookings.detail.approvalApproved')}{' '}
            {t('bookings.detail.approvalQrActive')}
          </>
        )}
        {status === 'REJECTED' && (
          <>
            {t('bookings.detail.approvalRejected', {
              reason: rejectionReason ?? t('bookings.detail.notRecorded'),
            })}
          </>
        )}
        {status === 'EXPIRED' && <>{t('bookings.detail.approvalExpired')}</>}
      </p>
    </div>
  )
}
