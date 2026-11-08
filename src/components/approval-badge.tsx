import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ApprovalStatus } from '@/lib/api/types'

const STYLES: Record<ApprovalStatus, { label: string; className: string } | null> = {
  // NOT_REQUIRED tidak ditampilkan: mayoritas booking ada di sini, dan badge
  // permanen di setiap baris hanya menambah gangguan visual.
  NOT_REQUIRED: null,
  PENDING: {
    label: 'Menunggu persetujuan',
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  },
  APPROVED: {
    label: 'Disetujui',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  REJECTED: {
    label: 'Ditolak',
    className: 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  },
  EXPIRED: {
    label: 'Kedaluwarsa',
    className: 'border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-400',
  },
}

export function ApprovalBadge({
  status,
  className,
}: {
  status: ApprovalStatus
  className?: string
}) {
  const style = STYLES[status]
  if (!style) return null
  return (
    <Badge variant='outline' className={cn('font-medium whitespace-nowrap', style.className, className)}>
      {style.label}
    </Badge>
  )
}
