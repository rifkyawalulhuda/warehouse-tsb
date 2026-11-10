import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
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
import type { ReportRow } from '@/lib/api/types'
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
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'

/**
 * Kolom angka memakai `accessorFn` numerik, bukan string: kalau tidak, "110"
 * terurut sebelum "12" dan baris tanpa nilai ikut menyelip di tengah.
 */
const columns: ColumnDef<ReportRow>[] = [
  {
    accessorKey: 'bookingCode',
    meta: { label: 'Kode', cellClassName: 'font-mono text-xs' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kode' />
    ),
  },
  {
    accessorKey: 'bookingDate',
    meta: { label: 'Tanggal', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tanggal' />
    ),
  },
  {
    accessorKey: 'customer',
    meta: { label: 'Customer', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Customer' />
    ),
  },
  {
    id: 'dockCode',
    accessorFn: (row) => row.dockCode ?? '',
    meta: { label: 'Dock', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Dock' />
    ),
    cell: ({ row }) => row.original.dockCode ?? '-',
  },
  {
    id: 'status',
    accessorFn: (row) => row.status,
    enableGlobalFilter: false,
    meta: { label: 'Status' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'waitingMinutes',
    // `?? undefined` (bukan `?? 0`) supaya TanStack menganggapnya kosong dan
    // `sortUndefined: 'last'` menaruh baris tanpa durasi di bawah, bukan di atas.
    accessorFn: (row) => row.waitingMinutes ?? undefined,
    meta: {
      label: 'Tunggu',
      headerClassName: 'text-end',
      cellClassName: 'text-end text-sm tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tunggu' />
    ),
    cell: ({ row }) => row.original.waitingMinutes ?? '-',
  },
  {
    id: 'processingMinutes',
    accessorFn: (row) => row.processingMinutes ?? undefined,
    meta: {
      label: 'Proses',
      headerClassName: 'text-end',
      cellClassName: 'text-end text-sm tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Proses' />
    ),
    cell: ({ row }) => row.original.processingMinutes ?? '-',
  },
  {
    id: 'turnaroundMinutes',
    accessorFn: (row) => row.turnaroundMinutes ?? undefined,
    meta: {
      label: 'Turnaround',
      headerClassName: 'text-end',
      cellClassName: 'text-end text-sm tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Turnaround' />
    ),
    cell: ({ row }) => row.original.turnaroundMinutes ?? '-',
  },
  {
    id: 'lateMinutes',
    accessorFn: (row) => (row.lateMinutes > 0 ? row.lateMinutes : undefined),
    meta: {
      label: 'Terlambat',
      headerClassName: 'text-end',
      cellClassName: 'text-end text-sm tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Terlambat' />
    ),
    cell: ({ row }) =>
      row.original.lateMinutes > 0 ? row.original.lateMinutes : '-',
  },
]

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
              <DataTable
                columns={columns}
                data={report.data.rows}
                getRowId={(row) => row.bookingCode}
                emptyMessage='Tidak ada booking pada rentang tanggal ini.'
              />
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
