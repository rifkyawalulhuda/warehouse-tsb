import type { DockWithBooking } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { DockActionButton, type DockActionHandlers } from './dock-action-button'
import {
  dockActivityLabel,
  dockPhase,
  processClock,
  shortClock,
  type DockGroup,
  type DockPhase,
  type ProcessClock,
} from './dock-model'

const toneText: Record<ProcessClock['tone'], string> = {
  'on-track': 'text-blue-700 dark:text-blue-300',
  near: 'text-amber-700 dark:text-amber-300',
  over: 'text-rose-700 dark:text-rose-300',
}

const toneBorder: Record<ProcessClock['tone'], string> = {
  'on-track': 'border-s-blue-500',
  near: 'border-s-amber-500',
  over: 'border-s-rose-500',
}

const phaseBorder: Record<DockPhase, string> = {
  starting: 'border-s-violet-500',
  serving: 'border-s-blue-500',
  available: 'border-s-emerald-500',
  maintenance: 'border-s-slate-400',
}

const phaseDot: Record<DockPhase, string> = {
  starting: 'bg-violet-500',
  serving: 'bg-blue-500',
  available: 'bg-emerald-500',
  maintenance: 'bg-slate-400',
}

/** Label pendek khusus grid; versi panjang tidak muat di ubin sempit. */
const phaseShort: Record<DockPhase, string> = {
  starting: 'Siap',
  serving: 'Diproses',
  available: 'Kosong',
  maintenance: 'Perawatan',
}

/**
 * Grid mini: banyak dock terlihat sekaligus dengan satu informasi kunci per
 * ubin (status, booking, jam). Cocok untuk memantau seluruh lantai dari satu
 * layar, bukan untuk membaca detail satu truk.
 */
export function DockGrid({
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
    <div className='flex flex-col gap-2'>
      <p className='text-xs text-muted-foreground'>
        Urutan: perlu dimulai, sedang diproses, kosong, lalu perawatan.
      </p>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6'>
        {docks.map((dock) => (
          <DockMiniTile
            key={dock.id}
            dock={dock}
            now={now}
            actionPending={actionPending}
            onStart={onStart}
            onFinish={onFinish}
          />
        ))}
      </div>
    </div>
  )
}

function DockMiniTile({
  dock,
  now,
  actionPending,
  onStart,
  onFinish,
}: DockActionHandlers & { dock: DockWithBooking; now: Date }) {
  const booking = dock.currentBooking
  const phase = dockPhase(dock)
  const serving = booking?.status === 'IN_PROGRESS'
  const clock = serving && booking ? processClock(booking, now) : null

  return (
    <Card
      className={cn(
        'gap-2 border-s-4 p-3',
        clock ? toneBorder[clock.tone] : phaseBorder[phase]
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <p className='truncate font-semibold leading-tight'>{dock.dockCode}</p>
        <span className='inline-flex shrink-0 items-center gap-1.5 text-xs font-medium'>
          <span
            aria-hidden
            className={cn('size-1.5 rounded-full', phaseDot[phase])}
          />
          {phaseShort[phase]}
        </span>
      </div>

      <p className='truncate text-xs text-muted-foreground'>
        {dockActivityLabel(dock.allowedActivity)}
      </p>

      <div className='min-h-9 min-w-0'>
        {booking ? (
          <>
            <p className='truncate font-mono text-xs font-medium'>
              {booking.bookingCode}
            </p>
            <p className='truncate text-xs text-muted-foreground'>
              {booking.licensePlate ?? 'Plat belum diisi'}
            </p>
          </>
        ) : (
          <p className='text-xs text-muted-foreground'>
            {phase === 'maintenance'
              ? 'Tidak dipakai'
              : 'Menunggu truk berikutnya'}
          </p>
        )}
      </div>

      <div className='flex items-end justify-between gap-2'>
        <div className='min-w-0 text-xs'>
          {clock && booking ? (
            <>
              <p
                className={cn(
                  'truncate font-medium tabular-nums',
                  toneText[clock.tone]
                )}
              >
                {shortClock(clock.elapsedMinutes)}
              </p>
              <p className='truncate text-muted-foreground tabular-nums'>
                {clock.overrunMinutes > 0
                  ? `Lewat ${shortClock(clock.overrunMinutes)}`
                  : `Sisa ${shortClock(clock.remainingMinutes)}`}
              </p>
            </>
          ) : booking ? (
            <p className='truncate text-muted-foreground tabular-nums'>
              Masuk {formatTime(booking.timeLog?.gateInAt ?? booking.startTime)}
            </p>
          ) : null}
        </div>
        {booking && (
          <DockActionButton
            dock={dock}
            iconOnly
            actionPending={actionPending}
            onStart={onStart}
            onFinish={onFinish}
          />
        )}
      </div>
    </Card>
  )
}
