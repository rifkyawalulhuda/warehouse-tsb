import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const map: Record<string, { label: string; className: string }> = {
  terjadwal: {
    label: 'Terjadwal',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  },
  'checked-in': {
    label: 'Checked-in',
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  proses: {
    label: 'In progress',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  },
  selesai: {
    label: 'Completed',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  terlambat: {
    label: 'Late',
    className:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  kosong: {
    label: 'Kosong',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  booking: {
    label: 'Booking',
    className:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const item = map[status] ?? {
    label: status,
    className: 'border-border bg-muted text-muted-foreground',
  }
  return (
    <Badge variant='outline' className={cn('font-medium', item.className, className)}>
      {item.label}
    </Badge>
  )
}
