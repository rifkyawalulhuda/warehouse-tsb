import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/lib/api/types'

const STATUS_STYLES: Record<BookingStatus, { label: string; className: string }> = {
  BOOKED_INCOMPLETE: {
    label: 'Data kendaraan belum lengkap',
    className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  BOOKED_READY: {
    label: 'Siap datang',
    className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  },
  CHECKED_IN_ON_TIME: {
    label: 'Check-in tepat waktu',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  LATE_WAITING_LIST: {
    label: 'Terlambat — waiting list',
    className: 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  },
  DOCK_ASSIGNED: {
    label: 'Dapat dock',
    className: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  IN_PROGRESS: {
    label: 'Sedang diproses',
    className: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  },
  COMPLETED: {
    label: 'Selesai',
    className: 'border-teal-300 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
  },
  CHECKED_OUT: {
    label: 'Keluar gudang',
    className: 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
  },
  CANCELLED: {
    label: 'Dibatalkan',
    className: 'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400',
  },
  NO_SHOW: {
    label: 'No show',
    className: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: BookingStatus
  className?: string
}) {
  const style = STATUS_STYLES[status]
  return (
    <Badge variant='outline' className={cn('font-medium whitespace-nowrap', style.className, className)}>
      {style.label}
    </Badge>
  )
}

export function statusLabel(status: BookingStatus): string {
  return STATUS_STYLES[status].label
}
