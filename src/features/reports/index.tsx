import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  fetchCustomerOptions,
  fetchKpi,
  reportExportUrl,
} from '@/lib/api/endpoints'
import { addDaysISO, formatDateShort, todayISO } from '@/lib/format'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'

export function ReportsPage() {
  useRealtimeSync()
  const [from, setFrom] = useState(addDaysISO(todayISO(), -6))
  const [to, setTo] = useState(todayISO())
  const [customerId, setCustomerId] = useState('ALL')

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: fetchCustomerOptions,
  })

  const report = useQuery({
    queryKey: ['reports', from, to, customerId],
    queryFn: () =>
      fetchKpi(from, to, customerId === 'ALL' ? undefined : customerId),
    enabled: from <= to,
  })

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Laporan'
        description='KPI operasional dan rekapitulasi per hari dalam rentang tanggal.'
        actions={
          <>
            <DatePicker
              value={from}
              max={to}
              onChange={setFrom}
              className='w-44'
            />
            <DatePicker
              value={to}
              min={from}
              max={todayISO()}
              onChange={setTo}
              className='w-44'
            />
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className='h-9 w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>Semua customer</SelectItem>
                {(customers.data ?? []).map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant='outline' disabled={!report.data}>
              <a
                href={reportExportUrl(
                  from,
                  to,
                  customerId === 'ALL' ? undefined : customerId
                )}
                download
              >
                <Download /> Ekspor Excel
              </a>
            </Button>
          </>
        }
      />

      {from > to ? (
        <p className='text-sm text-destructive'>
          Tanggal awal tidak boleh melewati tanggal akhir.
        </p>
      ) : report.isPending ? (
        <LoadingBlock label='Menghitung KPI...' />
      ) : report.isError ? (
        <ErrorBlock
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Kpi label='Total booking' value={report.data.kpi.totalBookings} />
            <Kpi
              label='Tingkat on-time'
              value={`${report.data.kpi.onTimeRate}%`}
              hint='Dari yang sudah gate-in'
            />
            <Kpi
              label='Rata-rata tunggu'
              value={`${report.data.kpi.averageWaitingMinutes} mnt`}
              hint='Gate-in → mulai proses'
            />
            <Kpi
              label='Rata-rata turnaround'
              value={`${report.data.kpi.averageTurnaroundMinutes} mnt`}
              hint='Gate-in → gate-out'
            />
            <Kpi label='Selesai' value={report.data.kpi.completed} />
            <Kpi label='Dibatalkan' value={report.data.kpi.cancelled} />
            <Kpi label='No-show' value={report.data.kpi.noShow} />
            <Kpi
              label='Kedaluwarsa'
              value={report.data.kpi.expiredPending}
              hint='Tidak diputuskan Admin'
            />
            <Kpi
              label='Rata-rata proses'
              value={`${report.data.kpi.averageProcessingMinutes} mnt`}
              hint='Mulai → selesai proses'
            />
          </div>

          <div className='grid gap-4 xl:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Booking per hari</CardTitle>
                <CardDescription>
                  Total, selesai, dan terlambat tiap hari dalam rentang.
                </CardDescription>
              </CardHeader>
              <CardContent className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart
                    data={report.data.byDay.map((day) => ({
                      ...day,
                      label: formatDateShort(`${day.date}T00:00:00.000Z`),
                    }))}
                  >
                    <CartesianGrid strokeDasharray='3 3' vertical={false} />
                    <XAxis
                      dataKey='label'
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey='total'
                      name='Total'
                      fill='var(--chart-1)'
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey='completed'
                      name='Selesai'
                      fill='var(--chart-2)'
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey='late'
                      name='Terlambat'
                      fill='var(--chart-4)'
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Kedatangan vs kapasitas slot
                </CardTitle>
                <CardDescription>
                  Jumlah gate-in per jam dibanding kapasitas jam tersebut.
                </CardDescription>
              </CardHeader>
              <CardContent className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={report.data.arrivalsByHour} barGap={2}>
                    <CartesianGrid strokeDasharray='3 3' vertical={false} />
                    <XAxis
                      dataKey='label'
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                    />
                    <Tooltip />
                    <Legend />
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
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Detail booking</CardTitle>
              <CardDescription>
                {report.data.rows.length} baris. Unduh Excel untuk data lengkap.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-end'>Tunggu</TableHead>
                      <TableHead className='text-end'>Proses</TableHead>
                      <TableHead className='text-end'>Turnaround</TableHead>
                      <TableHead className='text-end'>Terlambat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.data.rows.slice(0, 100).map((row) => (
                      <TableRow key={row.bookingCode}>
                        <TableCell className='font-mono text-xs'>
                          {row.bookingCode}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {row.bookingDate}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {row.customer}
                        </TableCell>
                        <TableCell className='text-sm'>
                          {row.dockCode ?? '-'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className='text-end text-sm tabular-nums'>
                          {row.waitingMinutes ?? '-'}
                        </TableCell>
                        <TableCell className='text-end text-sm tabular-nums'>
                          {row.processingMinutes ?? '-'}
                        </TableCell>
                        <TableCell className='text-end text-sm tabular-nums'>
                          {row.turnaroundMinutes ?? '-'}
                        </TableCell>
                        <TableCell className='text-end text-sm tabular-nums'>
                          {row.lateMinutes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </Main>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card>
      <CardContent className='space-y-1'>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <p className='text-2xl font-semibold tabular-nums'>{value}</p>
        {hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
      </CardContent>
    </Card>
  )
}
