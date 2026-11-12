import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, TimerReset } from 'lucide-react'
import { activityLabels, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { dockOptionLabel } from '@/lib/dock-label'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  eligibleDocks,
  laneDot,
  laneShortTitle,
  waitClock,
  waitLabel,
  type QueueRow,
  type WaitTone,
} from './queue-model'
import type { QueueActionHandlers } from './queue-table'

const toneText: Record<WaitTone, string> = {
  fresh: 'text-sky-700 dark:text-sky-300',
  waiting: 'text-amber-700 dark:text-amber-300',
  long: 'text-rose-700 dark:text-rose-300',
}

/**
 * Tampilan Ringkas: satu baris dua tingkat per truk, tanpa tombol berlabel.
 * Dibuat untuk memantau — seluruh hari muat dalam satu layar ponsel — lalu
 * berpindah ke Daftar atau Kartu saat ada yang perlu ditindak.
 *
 * Tombol tugaskan tetap ada sebagai ikon, karena menempatkan truk adalah satu-
 * satunya tindakan yang sering dilakukan sambil memantau.
 */
export function QueueCompact({
  rows,
  now,
  ...handlers
}: QueueActionHandlers & { rows: QueueRow[]; now: Date }) {
  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <ul className='divide-y'>
        {rows.map(({ booking, laneKey }) => {
          const clock = waitClock(booking, now)
          const free = eligibleDocks(booking, handlers.docks ?? [])
          const first = free[0] ?? null

          return (
            <li
              key={booking.id}
              className='flex items-center gap-2.5 px-3 py-2.5'
            >
              <span
                className={cn(
                  'mt-0.5 size-2 shrink-0 self-start rounded-full',
                  laneDot[laneKey]
                )}
                aria-hidden
              />

              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {booking.licensePlate ?? 'Plat belum diisi'}
                  <span className='font-mono text-xs font-normal text-muted-foreground'>
                    {' · '}
                    {booking.bookingCode}
                  </span>
                </p>
                <p className='truncate text-xs text-muted-foreground'>
                  {booking.customer.name} ·{' '}
                  {activityLabels[booking.activityType]} ·{' '}
                  {formatTime(booking.startTime)}
                </p>
              </div>

              <div className='shrink-0 text-end'>
                <p
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    clock ? toneText[clock.tone] : 'text-muted-foreground'
                  )}
                >
                  {laneKey === 'upcoming'
                    ? 'Belum datang'
                    : laneKey === 'atDock'
                      ? (booking.assignedDock?.dockCode ?? 'Tanpa dock')
                      : clock
                        ? waitLabel(clock.minutes)
                        : '—'}
                </p>
                <p className='text-[11px] text-muted-foreground'>
                  {laneShortTitle[laneKey]}
                </p>
              </div>

              {laneKey === 'atDock' ? (
                <Button asChild variant='ghost' size='icon' className='size-9'>
                  <Link
                    to='/dock'
                    aria-label={`Buka Papan Dock untuk ${booking.bookingCode}`}
                  >
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : laneKey === 'upcoming' ||
                booking.approvalStatus === 'PENDING' ||
                !first ||
                !handlers.onQuickAssign ? (
                <span className='size-9' aria-hidden />
              ) : (
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-9'
                  disabled={handlers.assigning}
                  aria-label={`Tugaskan ${booking.bookingCode} ke ${dockOptionLabel(first)}`}
                  onClick={() => handlers.onQuickAssign?.(booking, first)}
                >
                  {handlers.assigning ? (
                    <Loader2 className='animate-spin' aria-hidden />
                  ) : (
                    <TimerReset aria-hidden />
                  )}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
