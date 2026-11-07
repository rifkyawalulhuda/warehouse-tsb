import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Gauge,
  Minus,
  Timer,
  Truck,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { kpi } from '../data'

const icons = { truck: Truck, clock: Clock, gauge: Gauge, timer: Timer }

export function KpiCards() {
  return (
    <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
      {kpi.map((item) => {
        const Icon = icons[item.icon]
        const TrendIcon =
          item.trend === 'up'
            ? ArrowUpRight
            : item.trend === 'down'
              ? ArrowDownRight
              : Minus
        const trendClass =
          item.trend === 'up'
            ? 'text-emerald-600 dark:text-emerald-400'
            : item.trend === 'down'
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-muted-foreground'
        return (
          <Card key={item.label}>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center justify-between text-sm font-medium text-muted-foreground'>
                {item.label}
                <Icon className='size-4 text-muted-foreground' />
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-1'>
              <div className='flex items-baseline gap-1.5'>
                <span className='text-3xl font-semibold tracking-tight tabular-nums'>
                  {item.value}
                </span>
                {item.unit ? (
                  <span className='text-sm text-muted-foreground'>{item.unit}</span>
                ) : null}
              </div>
              <div className='flex items-center gap-1 text-xs'>
                <TrendIcon className={`size-3.5 ${trendClass}`} />
                <span className={trendClass}>{item.delta}</span>
              </div>
              <CardDescription className='text-xs'>{item.hint}</CardDescription>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
