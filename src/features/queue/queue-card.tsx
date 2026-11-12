import { Link } from '@tanstack/react-router'
import { ArrowRight, Clock3, Info, Loader2, TimerReset } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { activityLabels, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApprovalBadge } from '@/components/approval-badge'
import { DockPicker } from '@/components/dock-picker'
import { dockOptionLabel } from '@/lib/dock-label'
import { StatusBadge } from '@/components/status-badge'
import {
  WAIT_LONG_MINUTES,
  assignBlockReason,
  eligibleDocks,
  waitClock,
  waitLabel,
  type QueueLaneKey,
  type WaitTone,
} from './queue-model'

const toneText: Record<WaitTone, string> = {
  fresh: 'text-sky-700 dark:text-sky-300',
  waiting: 'text-amber-700 dark:text-amber-300',
  long: 'text-rose-700 dark:text-rose-300',
}

const toneBar: Record<WaitTone, string> = {
  fresh: 'bg-sky-500',
  waiting: 'bg-amber-500',
  long: 'bg-rose-500',
}

/** Aksen kiri mengikuti urgensi: lama menunggu, lalu kekhususan lane. */
function accentClass(laneKey: QueueLaneKey, tone: WaitTone | undefined) {
  if (laneKey === 'atDock') return 'border-l-violet-500'
  if (laneKey === 'upcoming')
    return 'border-l-slate-300 dark:border-l-slate-600'
  if (tone === 'long') return 'border-l-rose-500'
  if (tone === 'waiting') return 'border-l-amber-500'
  return 'border-l-sky-500'
}

/**
 * Satu truk di papan antrean. Jam tunggu berdetak dari gate-in supaya
 * pertanyaan "sudah berapa lama nangkring" terjawab tanpa membuka detail.
 *
 * Penugasan dock sengaja satu klik ke dock bebas pertama: penempatan truk
 * adalah kerja berulang sepanjang hari, dan dialog konfirmasi per truk membuat
 * checker menekan dua kali untuk satu keputusan yang bisa dibatalkan dari toast.
 * Nama dock ikut ditulis di tombol supaya klik itu tetap bisa ditebak, dan
 * pemilih dock lengkap tetap tersedia bila truk perlu dock tertentu.
 */
export function QueueCard({
  booking,
  laneKey,
  now,
  docks,
  onQuickAssign,
  onPickDock,
  onNoShow,
  assigning,
  assignReset,
}: {
  booking: Booking
  laneKey: QueueLaneKey
  now: Date
  docks?: DockWithBooking[]
  /** Satu klik ke dock bebas pertama. */
  onQuickAssign?: (booking: Booking, dock: DockWithBooking) => void
  /** Pilih dock tertentu lewat pencarian. */
  onPickDock?: (booking: Booking, dock: DockWithBooking) => void
  onNoShow?: (booking: Booking) => void
  assigning?: boolean
  assignReset?: number
}) {
  const clock = waitClock(booking, now)
  const pendingApproval = booking.approvalStatus === 'PENDING'
  const free = eligibleDocks(booking, docks ?? [])
  const first = free[0] ?? null

  const waitPercent = clock
    ? Math.min(100, Math.round((clock.minutes / WAIT_LONG_MINUTES) * 100))
    : 0

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden border-l-4 py-0 transition-shadow hover:shadow-sm',
        accentClass(laneKey, clock?.tone)
      )}
    >
      <div className='flex h-full flex-col gap-3 p-4'>
        <div className='flex flex-wrap items-start justify-between gap-x-2 gap-y-1'>
          <p className='min-w-0 flex-1 truncate font-mono text-xs font-medium text-muted-foreground'>
            {booking.bookingCode}
          </p>
          {/* Label status bisa panjang ("Terlambat — waiting list"); di kolom
              sempit ia turun ke baris sendiri alih-alih terpotong di tepi. */}
          <StatusBadge status={booking.status} />
        </div>

        <div className='min-w-0 space-y-0.5'>
          <p className='truncate text-base font-semibold'>
            {booking.licensePlate ?? 'Plat belum diisi'}
          </p>
          <p className='truncate text-sm text-muted-foreground'>
            {booking.customer.name}
            {booking.driverName ? ` · ${booking.driverName}` : ''}
          </p>
          <p className='text-xs text-muted-foreground'>
            {activityLabels[booking.activityType]} ·{' '}
            {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
          </p>
        </div>

        {laneKey === 'atDock' ? (
          <div className='rounded-lg border bg-muted/40 p-2.5'>
            <div className='flex items-baseline justify-between gap-2'>
              <span className='text-xs text-muted-foreground'>Dock</span>
              <span className='text-sm font-semibold'>
                {booking.assignedDock?.dockCode ?? '—'}
              </span>
            </div>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {booking.status === 'IN_PROGRESS'
                ? 'Sedang diproses'
                : 'Proses belum dimulai'}
              {clock ? ` · masuk ${formatTime(clock.since)}` : ''}
            </p>
          </div>
        ) : laneKey === 'upcoming' ? (
          <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <Clock3 className='size-3.5' aria-hidden />
            Belum gate-in · jadwal {formatTime(booking.startTime)}
          </p>
        ) : (
          <div className='space-y-0.5'>
            {clock ? (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-sm font-medium tabular-nums',
                  toneText[clock.tone]
                )}
              >
                <Clock3 className='size-4' aria-hidden />
                Menunggu {waitLabel(clock.minutes)}
              </p>
            ) : (
              <p className='text-sm text-muted-foreground'>Menunggu dock</p>
            )}
            {booking.lateMinutes > 0 && (
              <p className='text-xs font-medium text-rose-700 tabular-nums dark:text-rose-300'>
                +{booking.lateMinutes} mnt dari jadwal
              </p>
            )}
          </div>
        )}

        {pendingApproval && (
          <div className='flex flex-wrap items-center gap-1.5'>
            <ApprovalBadge status={booking.approvalStatus} />
            <span className='text-xs text-muted-foreground'>
              Menunggu persetujuan
            </span>
          </div>
        )}

        {laneKey === 'atDock' ? (
          <Button asChild variant='outline' className='mt-auto h-11 w-full'>
            <Link to='/dock'>
              Buka Papan Dock
              <ArrowRight data-icon='inline-end' />
            </Link>
          </Button>
        ) : laneKey === 'upcoming' ? null : (
          <>
            <div className='mt-auto flex flex-col gap-1.5'>
              {pendingApproval ? null : first && onQuickAssign ? (
                <Button
                  className='h-11 w-full'
                  disabled={assigning}
                  aria-label={`Tugaskan ${booking.bookingCode} ke ${dockOptionLabel(first)}`}
                  onClick={() => onQuickAssign(booking, first)}
                >
                  {assigning ? (
                    <Loader2 className='animate-spin' aria-hidden />
                  ) : (
                    <TimerReset aria-hidden />
                  )}
                  Tugaskan ke {first.dockCode}
                </Button>
              ) : (
                <p className='flex items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground'>
                  <Info className='mt-px size-3.5 shrink-0' aria-hidden />
                  {assignBlockReason(booking, docks ?? [])}
                </p>
              )}
            </div>

            {/* Aksi sekunder diberi garis pemisah: "No-show" membuang slot,
                jadi ia tidak boleh menempel di bawah tombol utama. */}
            {((free.length > 1 && onPickDock) || onNoShow) && (
              <div className='mt-3 flex items-center justify-between gap-2 border-t pt-1'>
                {free.length > 1 && onPickDock ? (
                  <DockPicker
                    // Pilihan direset lewat key setelah dipakai, supaya kode
                    // dock lama tidak tertinggal di tombol.
                    key={`${booking.id}-${assignReset}`}
                    docks={free}
                    variant='ghost'
                    size='sm'
                    disabled={assigning}
                    placeholder='Dock lain'
                    label={`Pilih dock lain untuk ${booking.bookingCode}`}
                    className='-ml-2 font-medium'
                    onSelect={(dock) => onPickDock(booking, dock)}
                  />
                ) : (
                  <span />
                )}
                {onNoShow && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='-mr-2 font-medium text-muted-foreground hover:text-destructive'
                    aria-label={`Tandai ${booking.bookingCode} tidak datang`}
                    onClick={() => onNoShow(booking)}
                  >
                    No-show
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bilah tunggu: seberapa dekat truk ini ke ambang "terlalu lama".
          Nilainya sudah ditulis di teks, jadi bilah ini hiasan yang
          disembunyikan dari pembaca layar. */}
      {clock && laneKey !== 'atDock' && (
        <div className='h-1 w-full bg-muted' aria-hidden>
          <div
            className={cn('h-full', toneBar[clock.tone])}
            style={{ width: `${waitPercent}%` }}
          />
        </div>
      )}
    </Card>
  )
}
