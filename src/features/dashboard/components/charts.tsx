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
import type { ArrivalHour, ReportDay } from '@/lib/api/types'
import { formatDateShort } from '@/lib/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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

export function ArrivalChart({ data }: { data: ArrivalHour[] }) {
  const peak = data.reduce(
    (best, item) => (item.arrivals > best.arrivals ? item : best),
    data[0] ?? { hour: 0, label: '-', arrivals: 0, capacity: 0 }
  )

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Kedatangan vs Kapasitas Slot</CardTitle>
        <CardDescription>
          Per jam operasional · puncak {peak.label} ({peak.arrivals} truk)
        </CardDescription>
      </CardHeader>
      <CardContent className='ps-0'>
        <ResponsiveContainer width='100%' height={250}>
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
            <XAxis dataKey='label' {...axis} />
            <YAxis {...axis} width={28} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--accent)' }} />
            <Bar
              dataKey='capacity'
              name='Kapasitas slot'
              fill='var(--chart-3)'
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Bar
              dataKey='arrivals'
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

export function TurnaroundChart({
  data,
  targetMinutes = 150,
}: {
  data: ReportDay[]
  targetMinutes?: number
}) {
  const rows = data.map((day) => ({
    day: formatDateShort(`${day.date}T00:00:00.000Z`),
    aktual: day.averageTurnaroundMinutes,
    target: targetMinutes,
  }))
  const last = rows[rows.length - 1]

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Turnaround Time</CardTitle>
        <CardDescription>
          Rata-rata per hari (menit) · target ≤ {targetMinutes} menit
          {last ? ` · terakhir ${last.aktual} menit` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className='ps-0'>
        <ResponsiveContainer width='100%' height={250}>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' vertical={false} />
            <XAxis dataKey='day' {...axis} />
            <YAxis {...axis} width={32} allowDecimals={false} />
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
            Target {targetMinutes} mnt
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
