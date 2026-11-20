import { cn } from '@/lib/utils'
import {
  dockGroupLabelKeys,
  dockPhaseLabelKeys,
  type DockPhase,
} from './dock-model'
import { useT } from '@/lib/i18n/hooks'

const pillClass: Record<DockPhase, string> = {
  starting: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  serving: 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200',
  available:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  maintenance: 'bg-muted text-muted-foreground',
}

export function DockStatusPill({
  phase,
  className,
}: {
  phase: DockPhase
  className?: string
}) {
  const t = useT()
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        pillClass[phase],
        className
      )}
    >
      {t(dockPhaseLabelKeys[phase])}
    </span>
  )
}

export function DockGroupLabel({ phase }: { phase: DockPhase }) {
  const t = useT()
  return <>{t(dockGroupLabelKeys[phase])}</>
}