import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { statusLabels } from '@/lib/format'
import { useLocale } from '@/lib/i18n'
import type { BookingStatus } from '@/lib/api/types'

/**
 * Label sengaja tidak ditulis di sini: `statusLabels` di `lib/format` membaca
 * kamus bahasa aktif. Dulu berkas ini punya salinan label sendiri, sehingga
 * mengganti bahasa meninggalkan badge berbahasa Indonesia di tengah layar Inggris.
 */
const STATUS_STYLES: Record<BookingStatus, { className: string }> = {
  BOOKED_INCOMPLETE: {
    className: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  BOOKED_READY: {
    className: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  },
  CHECKED_IN_ON_TIME: {
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  LATE_WAITING_LIST: {
    className: 'border-orange-300 bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  },
  DOCK_ASSIGNED: {
    className: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  IN_PROGRESS: {
    className: 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  },
  COMPLETED: {
    className: 'border-teal-300 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
  },
  CHECKED_OUT: {
    className: 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
  },
  CANCELLED: {
    className: 'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400',
  },
  NO_SHOW: {
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
  // Berlangganan bahasa aktif: label dibaca dari kamus saat render, jadi tanpa
  // langganan ini badge tertinggal berbahasa lama sampai ada render lain.
  useLocale()
  const style = STATUS_STYLES[status]
  return (
    <Badge variant='outline' className={cn('font-medium whitespace-nowrap', style.className, className)}>
      {statusLabels[status]}
    </Badge>
  )
}

export function statusLabel(status: BookingStatus): string {
  return statusLabels[status]
}
