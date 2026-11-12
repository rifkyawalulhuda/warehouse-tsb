import { cn } from '@/lib/utils'
import { dockPhaseLabels, type DockPhase } from './dock-model'

/**
 * Warna status selalu disertai label teks — checker yang tidak dapat
 * membedakan biru dan hijau tetap bisa membaca keadaannya.
 */
const phaseStyles: Record<DockPhase, { pill: string; dot: string }> = {
  starting: {
    pill: 'border-violet-300/70 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  serving: {
    pill: 'border-blue-300/70 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  available: {
    pill: 'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  maintenance: {
    pill: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-slate-400',
  },
}

const phaseShortLabels: Record<DockPhase, string> = {
  starting: 'Siap',
  serving: 'Diproses',
  available: 'Kosong',
  maintenance: 'Perawatan',
}

export function DockStatusPill({
  phase,
  compact = false,
  className,
}: {
  phase: DockPhase
  /** Di layar sempit label panjang dipendekkan agar tabel muat tanpa geser. */
  compact?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        phaseStyles[phase].pill,
        className
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', phaseStyles[phase].dot)}
      />
      {compact ? (
        <>
          <span className='sm:hidden'>{phaseShortLabels[phase]}</span>
          <span className='max-sm:hidden'>{dockPhaseLabels[phase]}</span>
        </>
      ) : (
        dockPhaseLabels[phase]
      )}
    </span>
  )
}
