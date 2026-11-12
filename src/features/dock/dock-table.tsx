import type { Booking, DockWithBooking } from '@/lib/api/types'
import { activityLabels, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DockActionButton, type DockActionHandlers } from './dock-action-button'
import {
  clockLabel,
  dockActivityLabel,
  dockPhase,
  processClock,
  shortClock,
  type DockGroup,
  type ProcessClock,
} from './dock-model'
import { DockStatusPill } from './dock-status-pill'

const toneText: Record<ProcessClock['tone'], string> = {
  'on-track': 'text-blue-700 dark:text-blue-300',
  near: 'text-amber-700 dark:text-amber-300',
  over: 'text-rose-700 dark:text-rose-300',
}

/**
 * Tampilan tabel untuk memindai banyak dock sekaligus: satu baris per dock,
 * diurutkan mengikuti urutan kerja checker. Kolomnya sengaja sama dengan isi
 * kartu (status, booking aktif, jam mulai, aksi) supaya berpindah tampilan
 * tidak mengubah arti.
 */
export function DockTable({
  groups,
  now,
  actionPending,
  onStart,
  onFinish,
}: DockActionHandlers & {
  groups: DockGroup[]
  now: Date
}) {
  const docks = groups.flatMap((group) => group.docks)

  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <Table>
        <TableCaption className='px-4 pb-4 text-start'>
          Urutan baris: perlu dimulai, sedang diproses, kosong, lalu perawatan.
        </TableCaption>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='h-11 ps-4'>Dock</TableHead>
            <TableHead className='h-11'>Status</TableHead>
            <TableHead className='h-11'>Booking aktif</TableHead>
            <TableHead className='h-11 max-md:hidden'>Jam proses</TableHead>
            <TableHead className='h-11 pe-4 text-end'>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docks.map((dock) => (
            <DockTableRow
              key={dock.id}
              dock={dock}
              now={now}
              actionPending={actionPending}
              onStart={onStart}
              onFinish={onFinish}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function DockTableRow({
  dock,
  now,
  ...handlers
}: DockActionHandlers & { dock: DockWithBooking; now: Date }) {
  const booking = dock.currentBooking
  const phase = dockPhase(dock)

  return (
    <TableRow>
      <TableCell className='ps-4'>
        <p className='font-semibold'>{dock.dockCode}</p>
        <p className='text-xs text-muted-foreground max-sm:hidden'>
          {dockActivityLabel(dock.allowedActivity)}
          {dock.areaName ? ` · ${dock.areaName}` : ''}
        </p>
      </TableCell>

      <TableCell>
        <DockStatusPill phase={phase} compact />
      </TableCell>

      <TableCell className='max-w-72 whitespace-normal'>
        {booking ? (
          <>
            <p className='font-mono text-xs font-medium whitespace-nowrap'>
              {booking.bookingCode}
            </p>
            {booking.status === 'IN_PROGRESS' && (
              <MobileClock booking={booking} now={now} />
            )}
            <p className='truncate text-xs text-muted-foreground max-sm:hidden'>
              {booking.customer.name} ·{' '}
              {booking.licensePlate ?? 'plat belum diisi'}
            </p>
            <p className='text-xs text-muted-foreground max-sm:hidden'>
              {activityLabels[booking.activityType]}
            </p>
          </>
        ) : (
          <span className='text-xs text-muted-foreground'>
            {phase === 'maintenance' ? 'Dock tidak dipakai' : 'Tidak ada truk'}
          </span>
        )}
      </TableCell>

      <TableCell className='max-md:hidden'>
        <ProcessCell dock={dock} now={now} />
      </TableCell>

      <TableCell className='pe-4 text-end'>
        <div className='flex justify-end'>
          <DockActionButton dock={dock} hideLabelOnMobile {...handlers} />
        </div>
      </TableCell>
    </TableRow>
  )
}

function MobileClock({ booking, now }: { booking: Booking; now: Date }) {
  const clock = processClock(booking, now)
  return (
    <div className='md:hidden'>
      <p
        className={cn(
          'text-xs font-medium tabular-nums whitespace-nowrap',
          toneText[clock.tone]
        )}
      >
        {shortClock(clock.elapsedMinutes)}
      </p>
      <p className='text-xs text-muted-foreground tabular-nums whitespace-nowrap'>
        {clock.overrunMinutes > 0
          ? `lewat ${shortClock(clock.overrunMinutes)}`
          : `sisa ${shortClock(clock.remainingMinutes)}`}
      </p>
    </div>
  )
}

function ProcessCell({ dock, now }: { dock: DockWithBooking; now: Date }) {
  const booking = dock.currentBooking
  if (!booking) {
    return <span className='text-xs text-muted-foreground'>—</span>
  }

  if (booking.status !== 'IN_PROGRESS') {
    return (
      <>
        <p className='text-xs tabular-nums'>
          Jadwal {formatTime(booking.startTime)}
        </p>
        <p className='text-xs text-muted-foreground'>
          {booking.timeLog?.gateInAt
            ? `Masuk ${formatTime(booking.timeLog.gateInAt)} · belum mulai`
            : 'Belum mulai proses'}
        </p>
      </>
    )
  }

  const clock = processClock(booking, now)
  return (
    <>
      <p className='text-xs tabular-nums'>
        Mulai {formatTime(booking.timeLog?.processStartedAt)}
      </p>
      <p
        className={cn(
          'text-xs font-medium tabular-nums',
          toneText[clock.tone]
        )}
      >
        {clockLabel(clock.elapsedMinutes)} dari{' '}
        {clockLabel(clock.targetMinutes)}{' '}
        <span className='font-normal'>
          ·{' '}
          {clock.overrunMinutes > 0
            ? `lewat ${clockLabel(clock.overrunMinutes)}`
            : `sisa ${clockLabel(clock.remainingMinutes)}`}
        </span>
      </p>
    </>
  )
}
