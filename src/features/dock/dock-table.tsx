import type { Booking, DockWithBooking } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
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
  dockActivityLabelKey,
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
  const t = useT()
  const docks = groups.flatMap((group) => group.docks)

  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <Table>
        <TableCaption className='px-4 pb-4 text-start'>
          {t('dock.tableOrder')}
        </TableCaption>
        <TableHeader>
          <TableRow className='bg-muted/40 hover:bg-muted/40'>
            <TableHead className='h-11 ps-4'>{t('dock.colDock')}</TableHead>
            <TableHead className='h-11'>{t('dock.colStatus')}</TableHead>
            <TableHead className='h-11'>{t('dock.colBooking')}</TableHead>
            <TableHead className='h-11 max-md:hidden'>
              {t('dock.colProcess')}
            </TableHead>
            <TableHead className='h-11 pe-4 text-end'>
              {t('dock.action')}
            </TableHead>
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
  const t = useT()
  const booking = dock.currentBooking
  const phase = dockPhase(dock)

  return (
    <TableRow>
      <TableCell className='ps-4'>
        <p className='font-semibold'>{dock.dockCode}</p>
        <p className='text-xs text-muted-foreground max-sm:hidden'>
          {t(dockActivityLabelKey(dock.allowedActivity))}
          {dock.areaName ? ` · ${dock.areaName}` : ''}
        </p>
      </TableCell>

      <TableCell>
        <DockStatusPill phase={phase} />
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
              {booking.customer.name}
              {booking.licensePlate
                ? ` · ${booking.licensePlate}`
                : t('dock.plateEmptyShort')}
            </p>
            <p className='text-xs text-muted-foreground max-sm:hidden'>
              {t(dockActivityLabelKey(booking.activityType))}
            </p>
          </>
        ) : (
          <span className='text-xs text-muted-foreground'>
            {phase === 'maintenance'
              ? t('dock.maintenanceNote')
              : t('dock.tableEmpty')}
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
  const t = useT()
  const clock = processClock(booking, now)
  return (
    <div className='md:hidden'>
      <p
        className={cn(
          'text-xs font-medium tabular-nums whitespace-nowrap',
          toneText[clock.tone]
        )}
      >
        {shortClock(clock.elapsedMinutes, t)}
      </p>
      <p className='text-xs text-muted-foreground tabular-nums whitespace-nowrap'>
        {clock.overrunMinutes > 0
          ? t('dock.overShort', { time: shortClock(clock.overrunMinutes, t) })
          : t('dock.remainingShort', {
              time: shortClock(clock.remainingMinutes, t),
            })}
      </p>
    </div>
  )
}

function ProcessCell({ dock, now }: { dock: DockWithBooking; now: Date }) {
  const t = useT()
  const booking = dock.currentBooking
  if (!booking) {
    return <span className='text-xs text-muted-foreground'>—</span>
  }

  if (booking.status !== 'IN_PROGRESS') {
    return (
      <>
        <p className='text-xs tabular-nums'>
          {t('dock.scheduleStart', { time: formatTime(booking.startTime) })}
        </p>
        <p className='text-xs text-muted-foreground'>
          {booking.timeLog?.gateInAt
            ? t('dock.gateInNotStarted', {
                time: formatTime(booking.timeLog.gateInAt),
              })
            : t('dock.notStarted')}
        </p>
      </>
    )
  }

  const clock = processClock(booking, now)
  return (
    <>
      <p className='text-xs tabular-nums'>
        {t('dock.startProcessAt', {
          time: formatTime(booking.timeLog?.processStartedAt),
        })}
      </p>
      <p
        className={cn(
          'text-xs font-medium tabular-nums',
          toneText[clock.tone]
        )}
      >
        {t('dock.processFrom', {
          elapsed: clockLabel(clock.elapsedMinutes, t),
          target: clockLabel(clock.targetMinutes, t),
        })}{' '}
        <span className='font-normal'>
          ·{' '}
          {clock.overrunMinutes > 0
            ? t('dock.overShort', { time: clockLabel(clock.overrunMinutes, t) })
            : t('dock.remainingShort', {
                time: clockLabel(clock.remainingMinutes, t),
              })}
        </span>
      </p>
    </>
  )
}