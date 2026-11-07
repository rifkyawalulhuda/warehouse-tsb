import {
  ArrowRightLeft,
  CheckCircle2,
  LogIn,
  LogOut,
  PlayCircle,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import type { ActivityItem } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type FeedKind = 'checkin' | 'assign' | 'start' | 'done' | 'checkout' | 'late' | 'cancel'

/** Aksi audit log dipetakan ke satu jenis visual; sisanya jatuh ke netral. */
function kindOf(action: string): FeedKind {
  if (action.includes('CANCEL') || action.includes('NO_SHOW')) return 'cancel'
  if (action.includes('LATE')) return 'late'
  if (action.includes('CHECK_OUT') || action.includes('GATE_OUT')) return 'checkout'
  if (action.includes('PROCESS_COMPLETE') || action.includes('COMPLETE')) return 'done'
  if (action.includes('PROCESS_START')) return 'start'
  if (action.includes('DOCK')) return 'assign'
  return 'checkin'
}

const meta: Record<FeedKind, { icon: React.ElementType; className: string }> = {
  checkin: {
    icon: LogIn,
    className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  assign: {
    icon: ArrowRightLeft,
    className: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  },
  start: {
    icon: PlayCircle,
    className: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  },
  done: {
    icon: CheckCircle2,
    className:
      'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  checkout: {
    icon: LogOut,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300',
  },
  late: {
    icon: TriangleAlert,
    className: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  },
  cancel: {
    icon: XCircle,
    className: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
  },
}

const actionLabel: Record<string, string> = {
  CHECK_IN_ON_TIME: 'check-in on-time',
  CHECK_IN_LATE: 'check-in terlambat',
  DOCK_ASSIGNED: 'dock diberikan',
  PROCESS_STARTED: 'mulai proses',
  PROCESS_COMPLETED: 'selesai proses',
  GATE_OUT: 'keluar gudang',
  BOOKING_CANCELLED: 'booking dibatalkan',
  MARKED_NO_SHOW: 'ditandai no-show',
  VEHICLE_UPDATED: 'data kendaraan diperbarui',
  BOOKING_CREATED: 'booking dibuat',
  BOOKING_UPDATED: 'booking diperbarui',
}

function title(item: ActivityItem) {
  const subject = item.licensePlate ?? item.bookingCode ?? 'Booking'
  const action = actionLabel[item.action] ?? item.action.toLowerCase().replace(/_/g, ' ')
  return `${subject} ${action}`
}

function detail(item: ActivityItem) {
  const parts = [item.customer, item.dockCode, item.userName].filter(Boolean)
  return parts.join(' · ') || '—'
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Aktivitas Terbaru</CardTitle>
        <CardDescription>Jejak audit gerbang dan dock</CardDescription>
      </CardHeader>
      <CardContent className='px-0'>
        <ScrollArea className='h-[290px]'>
          <ol className='space-y-0'>
            {items.map((item, index) => {
              const { icon: Icon, className } = meta[kindOf(item.action)]
              return (
                <li key={item.id} className='relative flex gap-3 px-6 pb-4'>
                  {index < items.length - 1 ? (
                    <span className='absolute start-[38px] top-9 h-full w-px bg-border' />
                  ) : null}
                  <span
                    className={cn(
                      'z-10 flex size-7 shrink-0 items-center justify-center rounded-full',
                      className
                    )}
                  >
                    <Icon className='size-3.5' />
                  </span>
                  <div className='min-w-0 space-y-0.5'>
                    <p className='text-sm leading-snug font-medium'>{title(item)}</p>
                    <p className='text-xs text-muted-foreground'>{detail(item)}</p>
                    <p className='text-[11px] text-muted-foreground/80'>
                      {formatTime(item.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
            {items.length === 0 ? (
              <li className='px-6 py-10 text-center text-sm text-muted-foreground'>
                Belum ada aktivitas tercatat.
              </li>
            ) : null}
          </ol>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
