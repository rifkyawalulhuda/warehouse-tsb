import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { arrivalByHour, turnaroundTrend } from '../data'

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: 'var(--popover-foreground)',
  boxShadow: '0 8px 24px rgb(0 0 0 / 0.08)',
}

const axis = {
  stroke: 'var(--muted-foreground)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
}

export function ArrivalChart() {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Kedatangan vs Kapasitas Slot</CardTitle>
        <CardDescription>
          Per jam operasional 08:00–17:00 · puncak 10:00 dan 14:00
        </CardDescription>
      </CardHeader>
      <CardContent className='ps-0'>
        <ResponsiveContainer width='100%' height={250}>
          <BarChart data={arrivalByHour} barGap={2}>
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='var(--border)'
              vertical={false}
            />
            <XAxis dataKey='hour' {...axis} />
            <YAxis {...axis} width={28} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent)' }} />
            <Bar
              dataKey='kapasitas'
              name='Kapasitas slot'
              fill='var(--chart-3)'
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              dataKey='datang'
              name='Kedatangan aktual'
              fill='var(--chart-1)'
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className='mt-2 flex items-center gap-4 ps-6 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <span className='size-2 rounded-sm bg-[var(--chart-1)]' />
            Kedatangan aktual
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='size-2 rounded-sm bg-[var(--chart-3)]' />
            Kapasitas slot
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export function TurnaroundChart() {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Turnaround Time</CardTitle>
        <CardDescription>
          Rata-rata per hari (menit) · target ≤ 150 menit
        </CardDescription>
      </CardHeader>
      <CardContent className='ps-0'>
        <ResponsiveContainer width='100%' height={250}>
          <LineChart data={turnaroundTrend}>
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='var(--border)'
              vertical={false}
            />
            <XAxis dataKey='day' {...axis} />
            <YAxis {...axis} width={32} domain={[100, 180]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type='monotone'
              dataKey='target'
              name='Target'
              stroke='var(--muted-foreground)'
              strokeDasharray='4 4'
              strokeWidth={2}
              dot={false}
            />
            <Line
              type='monotone'
              dataKey='aktual'
              name='Aktual'
              stroke='var(--chart-1)'
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--card)' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className='mt-2 flex items-center gap-4 ps-6 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1.5'>
            <span className='h-0.5 w-4 bg-[var(--chart-1)]' />
            Aktual
          </span>
          <span className='flex items-center gap-1.5'>
            <span className='h-0.5 w-4 border-t border-dashed border-muted-foreground' />
            Target 150 mnt
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
