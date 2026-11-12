import { Grid2x2, LayoutGrid, Table2 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { dockViewLabels, dockViews, isDockView, type DockView } from './dock-view'

const icons = {
  cards: LayoutGrid,
  table: Table2,
  grid: Grid2x2,
} as const

/**
 * Pemilih tampilan, bukan navigasi: halaman, saringan, dan pencarian tetap
 * sama, hanya kerapatan yang berubah. Karena itu bentuknya toggle group, dan
 * pilihannya disimpan per akun.
 */
export function DockViewSwitch({
  value,
  onChange,
}: {
  value: DockView
  onChange: (view: DockView) => void
}) {
  return (
    <ToggleGroup
      type='single'
      value={value}
      variant='outline'
      size='sm'
      aria-label='Pilih tampilan papan dock'
      onValueChange={(next) => {
        if (isDockView(next)) onChange(next)
      }}
    >
      {dockViews.map((view) => {
        const Icon = icons[view]
        return (
          <ToggleGroupItem
            key={view}
            value={view}
            aria-label={`Tampilan ${dockViewLabels[view]}`}
            className='h-9 gap-1.5 px-2.5 data-[state=on]:bg-secondary data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:h-8'
          >
            <Icon aria-hidden />
            <span>{dockViewLabels[view]}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
