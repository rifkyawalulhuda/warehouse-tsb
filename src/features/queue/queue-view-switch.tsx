import { AlignJustify, LayoutDashboard, LayoutGrid, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  isQueueView,
  queueViewLabelKey,
  queueViews,
  type QueueView,
} from './queue-view'

const icons = {
  board: LayoutDashboard,
  list: List,
  cards: LayoutGrid,
  compact: AlignJustify,
} as const

/**
 * Pemilih tampilan, bukan navigasi: tanggal, saringan, dan datanya tetap sama,
 * hanya bentuk penyajian yang berubah. Karena itu bentuknya toggle group.
 *
 * Di layar sempit teksnya disembunyikan: empat label + pemilih tanggal tidak
 * muat sebaris, dan ikonnya sudah dibedakan bentuknya. Nama lengkap tetap
 * terbaca pembaca layar lewat aria-label, bukan lewat warna atau posisi.
 */
export function QueueViewSwitch({
  value,
  onChange,
  className,
}: {
  value: QueueView
  onChange: (view: QueueView) => void
  className?: string
}) {
  const t = useT()
  return (
    <ToggleGroup
      type='single'
      value={value}
      variant='outline'
      size='sm'
      aria-label={t('queue.viewSwitch')}
      className={cn('bg-card', className)}
      onValueChange={(next) => {
        if (isQueueView(next)) onChange(next)
      }}
    >
      {queueViews.map((view) => {
        const Icon = icons[view]
        return (
          <ToggleGroupItem
            key={view}
            value={view}
            aria-label={t('queue.viewAria', {
              view: t(queueViewLabelKey[view]),
            })}
            className='h-9 gap-1.5 px-2.5 data-[state=on]:bg-secondary data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:h-8'
          >
            <Icon aria-hidden />
            <span className='max-sm:sr-only'>{t(queueViewLabelKey[view])}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
