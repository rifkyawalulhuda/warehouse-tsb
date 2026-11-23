import { CheckCircle2, Clock, PlayCircle } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { dockAreaSuffix, dockWithArea } from '@/lib/dock-label'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'
import {
  clockLabel,
  dockActivityLabelKey,
  processClock,
  type ProcessClock,
} from './dock-model'
import { DockStatusPill } from './dock-status-pill'

const clockStyles: Record<
  ProcessClock['tone'],
  { accent: string; bar: string; text: string }
> = {
  'on-track': {
    accent: 'border-l-blue-500',
    bar: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  near: {
    accent: 'border-l-amber-500',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  over: {
    accent: 'border-l-rose-500',
    bar: 'bg-rose-500',
    text: 'text-rose-700 dark:text-rose-300',
  },
}

const bookingActivityKeys = {
  LOADING: 'activity.LOADING',
  UNLOADING: 'activity.UNLOADING',
  BOTH: 'activity.BOTH',
} as const

/**
 * Kartu dock yang sedang dipakai truk. Aksen kiri dan bilah kemajuan mengikuti
 * jam proses, sehingga dock yang melewati target jadwal terlihat dari jauh
 * tanpa harus membaca angkanya.
 */
export function DockCard({
  dock,
  now,
  actionPending,
  onStart,
  onFinish,
}: {
  dock: DockWithBooking
  now: Date
  actionPending: boolean
  onStart: (booking: Booking, dock: DockWithBooking) => void
  onFinish: (booking: Booking, dock: DockWithBooking) => void
}) {
  const t = useT()
  const booking = dock.currentBooking
  if (!booking) return null

  const serving = booking.status === 'IN_PROGRESS'
  const clock = processClock(booking, now)
  const styles = serving
    ? clockStyles[clock.tone]
    : { accent: 'border-l-violet-500', bar: '', text: 'text-violet-700 dark:text-violet-300' }

  const driver = booking.driverName ? ` · ${booking.driverName}` : ''
  const progress = Math.min(100, Math.round(clock.ratio * 100))

  return (
    <Card
      className={cn(
        'h-full gap-0 overflow-hidden border-l-4 py-0',
        styles.accent
      )}
    >
      <div className='flex flex-1 flex-col gap-4 p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              {t('dock.colDock')}
            </p>
            <p className='text-2xl font-semibold leading-tight'>
              {dock.dockCode}
            </p>
            <p className='mt-0.5 text-xs text-muted-foreground'>
              {t(dockActivityLabelKey(dock.allowedActivity))}
              {dockAreaSuffix(dock.areaName)}
            </p>
          </div>
          <DockStatusPill phase={serving ? 'serving' : 'starting'} />
        </div>

        <div className='min-w-0 space-y-1'>
          <p className='truncate text-xl font-semibold'>
            {booking.licensePlate ?? t('dock.plateEmpty')}
          </p>
          <p className='truncate text-sm text-muted-foreground'>
            {booking.customer.name}
            {driver}
          </p>
          <div className='flex flex-wrap items-center gap-2 pt-1'>
            <Badge variant='outline' className='font-mono text-xs'>
              {booking.bookingCode}
            </Badge>
            <span className='text-xs text-muted-foreground'>
              {t(bookingActivityKeys[booking.activityType])}
            </span>
            <span className='text-xs text-muted-foreground'>
              {t('dock.schedule', {
                from: formatTime(booking.startTime),
                to: formatTime(booking.endTime),
              })}
            </span>
          </div>
        </div>

        {serving ? (
          <div className='space-y-2 rounded-lg border bg-muted/40 p-3'>
            <div className='flex items-baseline justify-between gap-2'>
              <span className='text-xs text-muted-foreground'>
                {t('dock.running')}
              </span>
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  styles.text
                )}
              >
                {clockLabel(clock.elapsedMinutes, t)}
              </span>
            </div>
            <div
              role='progressbar'
              aria-label={t('dock.progressAria', {
                dock: dockWithArea(dock),
                elapsed: clockLabel(clock.elapsedMinutes, t),
                target: clockLabel(clock.targetMinutes, t),
              })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className='h-1.5 overflow-hidden rounded-full bg-background'
            >
              <div
                className={cn('h-full rounded-full', styles.bar)}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
              <span>
                {t('dock.target', {
                  time: clockLabel(clock.targetMinutes, t),
                })}
              </span>
              <span className={cn('font-medium', styles.text)}>
                {clock.overrunMinutes > 0
                  ? t('dock.over', {
                      time: clockLabel(clock.overrunMinutes, t),
                    })
                  : t('dock.remaining', {
                      time: clockLabel(clock.remainingMinutes, t),
                    })}
              </span>
            </div>
            <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <Clock className='size-3.5' aria-hidden />
              {t('dock.startedAt', {
                time: formatTime(booking.timeLog?.processStartedAt),
              })}
              {booking.timeLog?.gateInAt
                ? t('dock.enteredAt', {
                    time: formatTime(booking.timeLog.gateInAt),
                  })
                : ''}
            </p>
          </div>
        ) : (
          <div className='space-y-1 rounded-lg border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/30'>
            <p className='text-sm font-medium text-violet-900 dark:text-violet-200'>
              {t('dock.waitStartTitle')}
            </p>
            <p className='text-xs text-violet-800 dark:text-violet-300'>
              {booking.timeLog?.gateInAt
                ? t('dock.enteredPrefix', {
                    time: formatTime(booking.timeLog.gateInAt),
                  })
                : ''}
              {t('dock.waitStartBody')}
            </p>
          </div>
        )}

        {serving ? (
          <Button
            size='lg'
            className='mt-auto w-full'
            disabled={actionPending}
            onClick={() => onFinish(booking, dock)}
          >
            <CheckCircle2 /> {t('dock.finishProcess')}
          </Button>
        ) : (
          <Button
            size='lg'
            className='mt-auto w-full'
            disabled={actionPending}
            onClick={() => onStart(booking, dock)}
          >
            <PlayCircle /> {t('dock.startProcess')}
          </Button>
        )}
      </div>
    </Card>
  )
}