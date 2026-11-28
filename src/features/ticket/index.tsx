import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Loader2, Lock, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { completeVehicleByTicket, fetchPublicTicket } from '@/lib/api/endpoints'
import { useBranding } from '@/lib/branding'
import { waNumber } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { closeTicketSocket, getTicketSocket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApprovalBadge } from '@/components/approval-badge'
import { BrandLogo } from '@/components/brand-logo'
import { LocaleSwitch } from '@/components/locale-switch'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { TicketPanel } from './ticket-panel'
import './ticket-print.css'
import { TicketTimeline } from './timeline'

/**
 * Halaman ini dibuka supir tanpa login. QR hanya ditampilkan setelah data
 * kendaraan lengkap, karena gate-in memang akan ditolak tanpanya — lebih baik
 * dicegah di sini daripada ditolak di gerbang.
 */
export function TicketPage() {
  const { token } = useParams({ from: '/t/$token' })
  const queryClient = useQueryClient()
  const brand = useBranding()
  const t = useT()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['ticket', token],
    queryFn: () => fetchPublicTicket(token),
    // Polling tetap ada sebagai jaring pengaman (mis. HP tertidur dan socket
    // terputus); realtime di bawah membuat perubahan terasa seketika.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'CHECKED_OUT' ||
        status === 'CANCELLED' ||
        status === 'NO_SHOW'
        ? false
        : 60_000
    },
  })

  // Tiket supir tidak punya sesi, jadi ia bergabung lewat qr_token. Tanpa ini
  // status di layar supir baru berubah saat polling berikutnya.
  useEffect(() => {
    const socket = getTicketSocket(token)
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['ticket', token] })
    }
    socket.on('booking.updated', refresh)
    socket.on('connect', refresh)
    return () => {
      socket.off('booking.updated', refresh)
      socket.off('connect', refresh)
      closeTicketSocket()
    }
  }, [token, queryClient])

  if (isPending) return <LoadingBlock label={t('ticket.loading')} />
  if (isError)
    return (
      <div className='mx-auto max-w-md p-6'>
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      </div>
    )

  const ticket = data
  const finished = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(
    ticket.status
  )

  // Dua syarat, bukan satu: kendaraan lengkap DAN sudah disetujui.
  // Keduanya bisa gagal bersamaan, jadi pesannya harus dibedakan — kalau
  // digabung, supir tidak tahu apa yang harus dilakukan.
  //
  // `!finished` penting: booking yang dibatalkan customer tetap ber-
  // `approvalStatus = PENDING`, dan tanpa syarat ini tiket yang sudah batal
  // memberi tahu supir untuk "menunggu persetujuan" yang tidak akan datang.
  const approvalBlocked = ticket.approvalStatus === 'PENDING' && !finished
  const qrVisible = ticket.vehicleComplete && !approvalBlocked

  return (
    <div className='mx-auto max-w-md space-y-4 p-4 pb-10 sm:p-6'>
      <div className='flex justify-end'>
        <LocaleSwitch />
      </div>
      <div className='space-y-1 text-center'>
        {/* Merek aplikasi di halaman tanpa sesi: supir perlu tahu tiket ini
            dari sistem mana, dan logonya jauh lebih cepat dikenali daripada
            nama gudang. */}
        <div className='mb-2 flex justify-center'>
          <BrandLogo
            name={brand.appName}
            logoUrl={brand.appLogoUrl}
            size={32}
          />
        </div>
        <p className='text-xs tracking-wide text-muted-foreground uppercase'>
          {ticket.warehouseName}
        </p>
        <h1 className='text-xl font-semibold'>{t('ticket.title')}</h1>
      </div>

      {(ticket.approvalStatus === 'REJECTED' ||
        ticket.approvalStatus === 'EXPIRED') && (
        <div className='rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm'>
          <p className='font-medium text-destructive'>
            {ticket.approvalStatus === 'REJECTED'
              ? t('ticket.rejected')
              : t('ticket.expired')}
          </p>
          <p className='mt-1 text-muted-foreground'>
            {ticket.approvalStatus === 'REJECTED'
              ? (ticket.rejectionReason ?? t('ticket.noReason'))
              : t('ticket.expiredBody')}
          </p>
        </div>
      )}

      <div className='flex flex-wrap items-center justify-center gap-2'>
        <StatusBadge status={ticket.status} />
        <ApprovalBadge status={ticket.approvalStatus} />
      </div>

      {qrVisible ? (
        <TicketPanel ticket={ticket} finished={finished} />
      ) : (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 pt-6 text-center'>
            <Lock className='size-6 text-muted-foreground' />
            <p className='text-sm font-medium'>{t('ticket.qrLocked')}</p>
            <p className='text-xs text-muted-foreground'>
              {approvalBlocked
                ? t('ticket.qrLockedApproval')
                : t('ticket.qrLockedVehicle')}
            </p>
            {approvalBlocked && !ticket.vehicleComplete && (
              <p className='text-xs text-amber-600 dark:text-amber-400'>
                {t('ticket.vehicleAlsoIncomplete')}
              </p>
            )}
            <Button className='mt-2 h-11' asChild variant='outline'>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  t('ticket.waTemplate', {
                    code: ticket.bookingCode,
                    warehouse: ticket.warehouseName,
                    link: window.location.href,
                  })
                )}`}
                target='_blank'
                rel='noreferrer'
              >
                <MessageCircle /> {t('ticket.sendWhatsapp')}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {!ticket.vehicleComplete && !finished && (
        <VehicleForm
          qrToken={ticket.qrToken}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['ticket', token] })
          }}
        />
      )}

      {ticket.timeLog?.gateInAt && (
        <Card>
          <CardContent className='pt-6'>
            <TicketTimeline
              steps={[
                { label: t('ticket.gateIn'), at: ticket.timeLog.gateInAt },
                {
                  label: t('ticket.processStart'),
                  at: ticket.timeLog.processStartedAt,
                },
                {
                  label: t('ticket.processDone'),
                  at: ticket.timeLog.processCompletedAt,
                },
                { label: t('ticket.gateOut'), at: ticket.timeLog.gateOutAt },
              ]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VehicleForm({
  qrToken,
  onSaved,
}: {
  qrToken: string
  onSaved: () => void
}) {
  const [licensePlate, setLicensePlate] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const t = useT()

  const save = useMutation({
    mutationFn: () =>
      completeVehicleByTicket(qrToken, {
        licensePlate: licensePlate.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim()
          ? waNumber(driverPhone.trim())
          : undefined,
      }),
    onSuccess: () => {
      toast.success(t('ticket.vehicleSaved'))
      onSaved()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <p className='text-sm font-medium'>{t('ticket.vehicleFormTitle')}</p>
        <div className='space-y-1'>
          <Label htmlFor='plate'>{t('ticket.plate')}</Label>
          <Input
            id='plate'
            value={licensePlate}
            onChange={(event) => setLicensePlate(event.target.value)}
            placeholder='B 1234 XYZ'
            className='uppercase'
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='driver'>{t('ticket.driver')}</Label>
          <Input
            id='driver'
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder={t('ticket.driver')}
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='phone'>{t('ticket.phone')}</Label>
          <Input
            id='phone'
            value={driverPhone}
            onChange={(event) => setDriverPhone(event.target.value)}
            placeholder='0812xxxxxxx'
          />
        </div>
        <Button
          className='w-full'
          disabled={
            save.isPending ||
            licensePlate.trim().length < 3 ||
            driverName.trim().length < 2
          }
          onClick={() => save.mutate()}
        >
          {save.isPending && <Loader2 className='animate-spin' />}
          {t('ticket.saveOpenQr')}
        </Button>
      </CardContent>
    </Card>
  )
}
