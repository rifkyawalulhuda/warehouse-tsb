import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Download, Loader2, Lock, MessageCircle, Printer } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { completeVehicleByTicket, fetchPublicTicket } from '@/lib/api/endpoints'
import { closeTicketSocket, getTicketSocket } from '@/lib/socket'
import { activityLabels, formatDate, formatTime, waNumber } from '@/lib/format'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Halaman ini dibuka supir tanpa login. QR hanya ditampilkan setelah data
 * kendaraan lengkap, karena gate-in memang akan ditolak tanpanya — lebih baik
 * dicegah di sini daripada ditolak di gerbang.
 */
export function TicketPage() {
  const { token } = useParams({ from: '/t/$token' })
  const queryClient = useQueryClient()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['ticket', token],
    queryFn: () => fetchPublicTicket(token),
    // Polling tetap ada sebagai jaring pengaman (mis. HP tertidur dan socket
    // terputus); realtime di bawah membuat perubahan terasa seketika.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'CHECKED_OUT' || status === 'CANCELLED' || status === 'NO_SHOW'
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

  if (isPending) return <LoadingBlock label='Memuat tiket...' />
  if (isError)
    return (
      <div className='mx-auto max-w-md p-6'>
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      </div>
    )

  const ticket = data
  const finished = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(ticket.status)

  return (
    <div className='mx-auto max-w-md space-y-4 p-4 pb-10 sm:p-6'>
      <div className='space-y-1 text-center'>
        <p className='text-xs uppercase tracking-wide text-muted-foreground'>
          {ticket.warehouseName}
        </p>
        <h1 className='text-xl font-semibold'>Tiket Truk</h1>
      </div>

      <Card>
        <CardContent className='space-y-5 pt-6'>
          <div className='space-y-2 text-center'>
            <p className='font-mono text-lg font-semibold'>{ticket.bookingCode}</p>
            <StatusBadge status={ticket.status} />
          </div>

          <div className='flex justify-center'>
            {ticket.vehicleComplete ? (
              <div className='rounded-xl border bg-white p-4' id='qr-sheet'>
                <QRCodeCanvas
                  id='ticket-qr'
                  value={ticket.qrToken}
                  size={220}
                  level='M'
                  marginSize={2}
                />
              </div>
            ) : (
              <div className='flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center'>
                <Lock className='size-6 text-muted-foreground' />
                <p className='text-sm font-medium'>QR terkunci</p>
                <p className='text-xs text-muted-foreground'>
                  Lengkapi plat nomor dan nama supir untuk membuka QR gate-in.
                </p>
              </div>
            )}
          </div>

          <dl className='space-y-2 border-t pt-4 text-sm'>
            <Row label='Aktivitas'>{activityLabels[ticket.activityType]}</Row>
            <Row label='Jenis truk'>{ticket.truckType.truckName}</Row>
            <Row label='Tanggal'>{formatDate(ticket.bookingDate)}</Row>
            <Row label='Jadwal'>
              {formatTime(ticket.startTime)}–{formatTime(ticket.endTime)}
            </Row>
            <Row label='Dokumen'>{ticket.referenceDocNo}</Row>
            <Row label='Plat nomor'>{ticket.licensePlate ?? '-'}</Row>
            <Row label='Supir'>{ticket.driverName ?? '-'}</Row>
            <Row label='Dock'>{ticket.dockCode ?? 'Belum ditentukan'}</Row>
            {ticket.lateMinutes > 0 && (
              <Row label='Terlambat'>
                <span className='text-orange-600'>{ticket.lateMinutes} menit</span>
              </Row>
            )}
          </dl>

          {!finished && (
            <div className='flex flex-wrap gap-2 border-t pt-4'>
              {ticket.vehicleComplete && (
                <>
                  <Button variant='outline' size='sm' onClick={() => downloadQr(ticket.bookingCode)}>
                    <Download /> Unduh QR
                  </Button>
                  <Button variant='outline' size='sm' onClick={() => window.print()}>
                    <Printer /> Cetak
                  </Button>
                </>
              )}
              <Button asChild size='sm' variant='outline'>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Tiket truk ${ticket.bookingCode} - ${ticket.warehouseName}\n${window.location.href}`
                  )}`}
                  target='_blank'
                  rel='noreferrer'
                >
                  <MessageCircle /> Kirim WhatsApp
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!ticket.vehicleComplete && (
        <VehicleForm
          qrToken={ticket.qrToken}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['ticket', token] })
          }}
        />
      )}

      {ticket.timeLog?.gateInAt && (
        <Card>
          <CardContent className='space-y-2 pt-6 text-sm'>
            <p className='text-xs uppercase tracking-wide text-muted-foreground'>
              Riwayat
            </p>
            <Row label='Masuk gate'>{formatTime(ticket.timeLog.gateInAt)}</Row>
            <Row label='Mulai proses'>{formatTime(ticket.timeLog.processStartedAt)}</Row>
            <Row label='Selesai proses'>{formatTime(ticket.timeLog.processCompletedAt)}</Row>
            <Row label='Keluar gate'>{formatTime(ticket.timeLog.gateOutAt)}</Row>
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

  const save = useMutation({
    mutationFn: () =>
      completeVehicleByTicket(qrToken, {
        licensePlate: licensePlate.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim() ? waNumber(driverPhone.trim()) : undefined,
      }),
    onSuccess: () => {
      toast.success('Data kendaraan tersimpan, QR terbuka')
      onSaved()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Card>
      <CardContent className='space-y-3 pt-6'>
        <p className='text-sm font-medium'>Lengkapi data kendaraan</p>
        <div className='space-y-1'>
          <Label htmlFor='plate'>Plat nomor</Label>
          <Input
            id='plate'
            value={licensePlate}
            onChange={(event) => setLicensePlate(event.target.value)}
            placeholder='B 1234 XYZ'
            className='uppercase'
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='driver'>Nama supir</Label>
          <Input
            id='driver'
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder='Nama supir'
          />
        </div>
        <div className='space-y-1'>
          <Label htmlFor='phone'>Nomor HP supir (opsional)</Label>
          <Input
            id='phone'
            value={driverPhone}
            onChange={(event) => setDriverPhone(event.target.value)}
            placeholder='0812xxxxxxx'
          />
        </div>
        <Button
          className='w-full'
          disabled={save.isPending || licensePlate.trim().length < 3 || driverName.trim().length < 2}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Loader2 className='animate-spin' />}
          Simpan & buka QR
        </Button>
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='text-end font-medium'>{children}</dd>
    </div>
  )
}

function downloadQr(bookingCode: string) {
  const canvas = document.getElementById('ticket-qr') as HTMLCanvasElement | null
  if (!canvas) return
  const link = document.createElement('a')
  link.download = `tiket-${bookingCode}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
