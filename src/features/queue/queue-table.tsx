import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, TimerReset } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { activityLabels, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dockOptionLabel } from '@/lib/dock-label'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DockPicker } from '@/components/dock-picker'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  assignBlockReason,
  eligibleDocks,
  laneDot,
  laneShortTitle,
  laneTitle,
  waitClock,
  waitLabel,
  type QueueLaneKey,
  type QueueRow,
  type WaitTone,
} from './queue-model'

const toneText: Record<WaitTone, string> = {
  fresh: 'text-sky-700 dark:text-sky-300',
  waiting: 'text-amber-700 dark:text-amber-300',
  long: 'text-rose-700 dark:text-rose-300',
}

export type QueueActionHandlers = {
  docks?: DockWithBooking[]
  onQuickAssign?: (booking: Booking, dock: DockWithBooking) => void
  onPickDock?: (booking: Booking, dock: DockWithBooking) => void
  onNoShow?: (booking: Booking) => void
  assigning?: boolean
  /** Dinaikkan setiap penugasan dipakai, supaya pemilih dock kembali kosong. */
  assignReset?: number
}

/**
 * Tampilan Daftar: satu baris per truk, urut tahap lalu urut tunggu. Dipakai
 * saat checker perlu memindai seluruh hari tanpa menggulir empat kolom.
 *
 * Kolom yang tidak muat di layar sempit dilepas, bukan digeser ke samping:
 * tahap, jam tunggu, dan customer turun ke baris kecil di bawah plat. Tabel
 * yang harus digeser menyembunyikan kolom Aksi di ujung kanan — justru satu-
 * satunya tombol yang dibutuhkan di lapangan.
 */
export function QueueTable({
  rows,
  now,
  ...handlers
}: QueueActionHandlers & { rows: QueueRow[]; now: Date }) {
  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <Table>
        <TableCaption className='px-4 pb-4 text-start'>
          Semua truk pada tanggal ini. Yang paling lama menunggu lebih dulu di
          setiap tahap.
        </TableCaption>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='h-11 ps-4'>Truk</TableHead>
            <TableHead className='h-11 max-md:hidden'>Customer</TableHead>
            <TableHead className='h-11 max-lg:hidden'>Jadwal</TableHead>
            <TableHead className='h-11 max-md:hidden'>Tahap</TableHead>
            <TableHead className='h-11 max-md:hidden'>Tunggu</TableHead>
            <TableHead className='h-11 pe-4 text-end max-md:hidden'>
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <QueueTableRow
              key={row.booking.id}
              row={row}
              now={now}
              {...handlers}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function QueueTableRow({
  row,
  now,
  ...handlers
}: QueueActionHandlers & { row: QueueRow; now: Date }) {
  const { booking, laneKey } = row
  const pendingApproval = booking.approvalStatus === 'PENDING'

  return (
    <>
      <TableRow>
        <TableCell className='ps-4'>
        <p className='font-mono text-xs text-muted-foreground'>
          {booking.bookingCode}
        </p>
        <p className='text-sm font-semibold'>
          {booking.licensePlate ?? 'Plat belum diisi'}
        </p>
        {/* Ringkasan yang hilang bersama kolomnya di layar sempit. */}
        <p className='text-xs text-muted-foreground tabular-nums md:hidden'>
          <span className='font-medium'>{laneShortTitle[laneKey]}</span>
          {mobileSummary(booking, laneKey, now)}
        </p>
        {pendingApproval && (
          <p className='text-xs font-medium text-amber-700 dark:text-amber-300'>
            Menunggu persetujuan
          </p>
        )}
      </TableCell>

      <TableCell className='max-w-56 whitespace-normal max-md:hidden'>
        <p className='truncate text-sm'>{booking.customer.name}</p>
        <p className='truncate text-xs text-muted-foreground'>
          {booking.driverName ?? 'Sopir belum diisi'}
        </p>
      </TableCell>

      <TableCell className='max-lg:hidden'>
        <p className='text-xs tabular-nums'>
          {formatTime(booking.startTime)}–{formatTime(booking.endTime)}
        </p>
        <p className='text-xs text-muted-foreground'>
          {activityLabels[booking.activityType]}
        </p>
      </TableCell>

      <TableCell className='max-md:hidden'>
        <span className='inline-flex items-center gap-1.5 text-xs font-medium'>
          <span
            className={cn('size-2 rounded-full', laneDot[laneKey])}
            aria-hidden
          />
          {laneTitle[laneKey]}
        </span>
      </TableCell>

      <TableCell className='max-md:hidden'>
        <WaitCell booking={booking} laneKey={laneKey} now={now} />
      </TableCell>

      <TableCell className='pe-4 text-end max-md:hidden'>
        <div className='flex justify-end'>
          <QueueRowActions
            booking={booking}
            laneKey={laneKey}
            pendingApproval={pendingApproval}
            {...handlers}
          />
        </div>
      </TableCell>
    </TableRow>

    {/* Layar sempit: kolom Aksi dilepas dari baris dan dipindah ke barisnya
        sendiri. Label tombolnya tetap utuh — teks alasan selebar 192 px di
        dalam kolom sempit membuat tabel meluber dan terpotong oleh kartu. */}
    <TableRow className='md:hidden'>
      <TableCell colSpan={6} className='ps-4 pe-4'>
        <QueueRowActions
          booking={booking}
          laneKey={laneKey}
          pendingApproval={pendingApproval}
          inline
          {...handlers}
        />
      </TableCell>
    </TableRow>
    </>
  )
}

/** "· 24 mnt menunggu" / "· L2" / "· belum gate-in" untuk baris ponsel. */
function mobileSummary(booking: Booking, laneKey: QueueLaneKey, now: Date) {
  if (laneKey === 'upcoming') return ' · belum gate-in'
  if (laneKey === 'atDock') {
    return ` · ${booking.assignedDock?.dockCode ?? 'tanpa dock'}`
  }
  const clock = waitClock(booking, now)
  return clock ? ` · ${waitLabel(clock.minutes)}` : ''
}

function WaitCell({
  booking,
  laneKey,
  now,
}: {
  booking: Booking
  laneKey: QueueLaneKey
  now: Date
}) {
  if (laneKey === 'upcoming') {
    return <span className='text-xs text-muted-foreground'>Belum gate-in</span>
  }

  const clock = waitClock(booking, now)
  if (!clock) return <span className='text-xs text-muted-foreground'>—</span>

  return (
    <>
      <p
        className={cn(
          'text-xs font-medium tabular-nums',
          toneText[clock.tone]
        )}
      >
        {waitLabel(clock.minutes)}
      </p>
      <p className='text-xs text-muted-foreground'>
        {laneKey === 'atDock'
          ? `di ${booking.assignedDock?.dockCode ?? '—'}`
          : `masuk ${formatTime(clock.since)}`}
      </p>
    </>
  )
}

/**
 * Aksi baris. Berlabel, bukan ikon: di tabel, satu baris hanya muncul sekali,
 * jadi teks "Tugaskan ke L1" lebih cepat dipahami daripada ikon panah yang
 * harus ditebak artinya. Di layar sempit tombolnya menumpuk selebar sel agar
 * kolom Aksi tidak menghimpit kolom Truk.
 *
 * Menu dock yang bisa menerima truk ini tetap tersedia lewat pemilih, sehingga
 * checker yang butuh dock tertentu tidak harus pindah ke tampilan Kartu.
 */
export function QueueRowActions({
  booking,
  laneKey,
  pendingApproval,
  docks,
  onQuickAssign,
  onPickDock,
  onNoShow,
  assigning,
  assignReset,
  inline,
}: QueueActionHandlers & {
  booking: Booking
  laneKey: QueueLaneKey
  pendingApproval: boolean
  /** Deretan tombol sebaris, dipakai di baris aksi layar sempit. */
  inline?: boolean
}) {
  if (laneKey === 'atDock') {
    return (
      <Button asChild variant='outline' size='sm' className='h-9'>
        <Link
          to='/dock'
          aria-label={`Buka Papan Dock untuk ${booking.bookingCode}`}
        >
          Buka dock
          <ArrowRight data-icon='inline-end' />
        </Link>
      </Button>
    )
  }

  if (laneKey === 'upcoming') {
    return (
      <span className='text-xs text-muted-foreground'>
        <span aria-hidden>—</span>
        <span className='sr-only'>Belum gate-in, belum bisa ditugaskan</span>
      </span>
    )
  }

  const free = eligibleDocks(booking, docks ?? [])
  const first = free[0] ?? null

  if (pendingApproval) {
    return (
      <span className='text-xs text-muted-foreground'>Menunggu persetujuan</span>
    )
  }

  return (
    <div
      className={cn(
        inline
          ? 'flex flex-wrap items-center gap-1.5'
          : 'flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'
      )}
    >
      {first && onQuickAssign ? (
        <Button
          size='sm'
          className='h-9'
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
        <span className='max-w-48 whitespace-normal text-xs text-muted-foreground'>
          {assignBlockReason(booking, docks ?? [])}
        </span>
      )}

      <div
        className={cn(
          'flex items-center gap-1',
          !inline && 'w-full justify-between sm:w-auto sm:justify-end'
        )}
      >
        {free.length > 1 && onPickDock ? (
          <DockPicker
            // Pilihan direset lewat key setelah dipakai, supaya kode dock lama
            // tidak tertinggal di tombol.
            key={`${booking.id}-${assignReset}`}
            docks={free}
            variant='ghost'
            size='sm'
            disabled={assigning}
            placeholder='Dock lain'
            label={`Pilih dock lain untuk ${booking.bookingCode}`}
            onSelect={(dock) => onPickDock(booking, dock)}
          />
        ) : (
          <span />
        )}

        {onNoShow && (
          <Button
            variant='ghost'
            size='sm'
            className='text-muted-foreground hover:text-destructive'
            aria-label={`Tandai ${booking.bookingCode} tidak datang`}
            onClick={() => onNoShow(booking)}
          >
            No-show
          </Button>
        )}
      </div>
    </div>
  )
}
