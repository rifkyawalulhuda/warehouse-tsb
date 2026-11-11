import { Wrench } from 'lucide-react'
import type { DockWithBooking } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { dockActivityLabel, dockPhase } from './dock-model'

/**
 * Baris ringkas untuk dock tanpa truk. Dipakai supaya dock yang menganggur
 * tidak memakan tinggi kartu sebesar dock yang sedang melayani.
 */
export function DockTile({ dock }: { dock: DockWithBooking }) {
  const maintenance = dockPhase(dock) === 'maintenance'

  return (
    <Card className={cn('gap-0 py-0', maintenance && 'bg-muted/40')}>
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        <div className='flex min-w-0 items-center gap-3'>
          <span
            aria-hidden
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              maintenance ? 'bg-slate-400' : 'bg-emerald-500'
            )}
          />
          <div className='min-w-0'>
            <p className='font-semibold leading-tight'>{dock.dockCode}</p>
            <p className='text-xs text-muted-foreground'>
              {dockActivityLabel(dock.allowedActivity)}
            </p>
          </div>
        </div>
        <span className='inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground'>
          {maintenance && <Wrench className='size-3.5' aria-hidden />}
          {maintenance ? 'Perawatan' : 'Menunggu truk'}
        </span>
      </div>
    </Card>
  )
}
