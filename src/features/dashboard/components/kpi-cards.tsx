import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gauge,
  Timer,
  TrendingUp,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type KpiItem = {
  label: string
  value: number | string
  unit?: string
  delta: string
  trend: 'up' | 'down' | 'flat'
  hint: string
  icon: 'truck' | 'clock' | 'gauge' | 'timer'
}

const icons: Record<KpiItem['icon'], LucideIcon> = {
  truck: Truck,
  clock: TrendingUp,
  gauge: Gauge,
  timer: Timer,
}

const iconTone: Record<KpiItem['icon'], string> = {
  truck:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  clock:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  gauge: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  timer:
    'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
}

const trendTone: Record<KpiItem['trend'], string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-rose-600 dark:text-rose-400',
  flat: 'text-muted-foreground',
}

function TrendIcon({ trend }: { trend: KpiItem['trend'] }) {
  if (trend === 'up') return <ArrowUpRight className='size-3.5 shrink-0' />
  if (trend === 'down') return <ArrowDownRight className='size-3.5 shrink-0' />
  return <ArrowRight className='size-3.5 shrink-0' />
}

/**
 * Empat angka kunci. Sengaja dua kolom sejak layar kecil: satu kolom membuat
 * pengguna menggulir empat kartu sebelum sempat melihat dock, padahal itu
 * pekerjaan utamanya.
 */
export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className='grid grid-cols-2 gap-3 xl:grid-cols-4'>
      {items.map((item) => {
        const Icon = icons[item.icon]
        return (
          <Card key={item.label} className='h-full gap-0 py-3.5'>
            <CardContent className='flex h-full flex-col gap-2 px-3.5 sm:px-4'>
              <div className='flex items-start justify-between gap-2'>
                <p className='min-w-0 text-xs leading-snug font-medium text-muted-foreground'>
                  {item.label}
                </p>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md',
                    iconTone[item.icon]
                  )}
                >
                  <Icon className='size-4' />
                </span>
              </div>
              <p className='flex items-baseline gap-1'>
                <span className='text-2xl leading-none font-semibold tabular-nums'>
                  {item.value}
                </span>
                {item.unit ? (
                  <span className='text-xs font-medium text-muted-foreground'>
                    {item.unit}
                  </span>
                ) : null}
              </p>
              <p
                className={cn(
                  'flex items-start gap-1 text-xs leading-snug font-medium',
                  trendTone[item.trend]
                )}
              >
                <TrendIcon trend={item.trend} />
                <span className='min-w-0'>{item.delta}</span>
              </p>
              <p className='mt-auto text-[11px] leading-snug text-muted-foreground'>
                {item.hint}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
