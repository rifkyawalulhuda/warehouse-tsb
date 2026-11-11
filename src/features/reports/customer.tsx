import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, RefreshCwIcon } from 'lucide-react'
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
import { useCustomerName } from '@/stores/auth-store'
import { fetchMyReport, myReportExportUrl } from '@/lib/api/endpoints'
import type { CustomerReportRow } from '@/lib/api/types'
import { addDaysISO, formatDate, formatDateShort, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { StatusBadge } from '@/components/status-badge'

/**
 * Kolom angka memakai `accessorFn` numerik supaya "110" tidak terurut sebelum
 * "12", dan baris tanpa durasi jatuh ke bawah (`sortUndefined: 'last'`).
 */
const columns: ColumnDef<CustomerReportRow>[] = [
  {
    accessorKey: 'bookingCode',
    meta: { label: 'Kode', cellClassName: 'font-mono text-xs' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kode' />
    ),
  },
  {
    id: 'bookingDate',
    accessorFn: (row) => row.bookingDate,
    meta: { label: 'Tanggal', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tanggal' />
    ),
    cell: ({ row }) => formatDate(`${row.original.bookingDate}T00:00:00.000Z`),
  },
  {
    id: 'licensePlate',
    accessorFn: (row) => row.licensePlate ?? '',
    meta: { label: 'Plat', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Plat' />
    ),
    cell: ({ row }) => row.original.licensePlate ?? '-',
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
  {
    id: 'slotUsedPercent',
    accessorFn: (row) => row.slotUsedPercent ?? undefined,
    meta: {
      label: 'Slot',
      headerClassName: 'text-end',
      cellClassName: 'text-end text-sm tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Slot' />
    ),
    cell: ({ row }) => <SlotUsage row={row.original} />,
  },
]

const rangePresets = [
  { label: 'Hari ini', days: 0 },
  { label: '7 hari', days: 6 },
  { label: '30 hari', days: 29 },
] as const

const DEFAULT_RANGE_DAYS = 6

export function CustomerReportsPage() {
  useRealtimeSync()
  const isMobile = useIsMobile()
  const company = useCustomerName()
  const today = todayISO()
  const defaultFrom = addDaysISO(today, -DEFAULT_RANGE_DAYS)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)

  const rangeInvalid = from > to
  const isDefaultRange = from === defaultFrom && to === today

  const report = useQuery({
    queryKey: ['reports', 'my', from, to],
    queryFn: () => fetchMyReport(from, to),
    enabled: !rangeInvalid,
    // Rentang baru tidak mengosongkan layar; angka lama tetap tampil sampai
    // respons berikutnya datang.
    placeholderData: keepPreviousData,
  })

  const applyPreset = (days: number) => {
    setFrom(addDaysISO(today, -days))
    setTo(today)
  }

  const resetFilters = () => {
    setFrom(defaultFrom)
    setTo(today)
  }

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        eyebrow={company ?? undefined}
        title='Laporan'
        description='Rekap booking perusahaan Anda: ketepatan waktu, durasi layanan, dan pemakaian slot.'
      />

      <Card>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='my-report-from'
                className='text-xs font-medium text-muted-foreground'
              >
                Dari tanggal
              </Label>
              <DatePicker
                id='my-report-from'
                value={from}
                max={to}
                onChange={setFrom}
                className='w-full sm:w-44'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='my-report-to'
                className='text-xs font-medium text-muted-foreground'
              >
                Sampai tanggal
              </Label>
              <DatePicker
                id='my-report-to'
                value={to}
                min={from}
                max={today}
                onChange={setTo}
                className='w-full sm:w-44'
              />
            </div>

            <div className='flex items-center gap-2 sm:ms-auto'>
              <Button
                variant='outline'
                size='icon'
                className='size-11 shrink-0 sm:size-9'
                onClick={() => void report.refetch()}
                disabled={report.isFetching || rangeInvalid}
                aria-label='Muat ulang laporan'
              >
                <RefreshCwIcon
                  className={report.isFetching ? 'animate-spin' : undefined}
                />
              </Button>
              {/*
                `disabled` tidak berlaku pada <a>, jadi tautan ekspor baru
                dirender ketika data rentang terpilih sudah benar-benar masuk.
                Selama data lama masih tampil, tombolnya mati agar unduhan
                tidak memakai rentang yang hasilnya belum tiba.
              */}
              {report.data && !report.isPlaceholderData ? (
                <Button asChild variant='outline'>
                  <a href={myReportExportUrl(from, to)} download>
                    <Download /> Ekspor Excel
                  </a>
                </Button>
              ) : (
                <Button variant='outline' disabled>
                  <Download /> Ekspor Excel
                </Button>
              )}
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <div
              role='group'
              aria-label='Rentang tanggal cepat'
              className='flex flex-wrap items-center gap-2'
            >
              {rangePresets.map((preset) => {
                const presetFrom = addDaysISO(today, -preset.days)
                const active = from === presetFrom && to === today
                return (
                  <Button
                    key={preset.label}
                    variant={active ? 'secondary' : 'outline'}
                    aria-pressed={active}
                    onClick={() => applyPreset(preset.days)}
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
            <Button
              variant='ghost'
              onClick={resetFilters}
              disabled={isDefaultRange}
            >
              Atur ulang
            </Button>
            <span
              role='status'
              aria-live='polite'
              className='text-xs text-muted-foreground'
            >
              {report.isPlaceholderData ? 'Memperbarui laporan...' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {rangeInvalid ? (
        <p className='text-sm text-destructive'>
          Tanggal awal tidak boleh melewati tanggal akhir.
        </p>
      ) : report.isPending ? (
        <LoadingBlock label='Menghitung laporan...' />
      ) : report.isError ? (
        <ErrorBlock
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      ) : (
        <div
          aria-busy={report.isPlaceholderData}
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            report.isPlaceholderData && 'opacity-60'
          )}
        >
          <div>
            <p className='mb-2 text-xs font-medium text-muted-foreground'>
              {report.data.customer.name} · {report.data.customer.code}
            </p>
            <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
              <Kpi
                label='Total booking'
                value={report.data.kpi.totalBookings}
              />
              <Kpi
                label='Tingkat on-time'
                value={`${report.data.kpi.onTimeRate}%`}
                hint='Dari yang sudah gate-in'
              />
              <Kpi
                label='Rata-rata turnaround'
                value={`${report.data.kpi.averageTurnaroundMinutes} mnt`}
                hint='Gate-in sampai gate-out'
              />
              <Kpi
                label='Pemakaian slot'
                value={`${report.data.kpi.averageSlotUsedPercent}%`}
                hint='Dibanding blok yang Anda booking'
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Rincian</CardTitle>
              <CardDescription>
                Status booking dan durasi rata-rata pada rentang ini.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-7'>
              <Stat label='Selesai' value={report.data.kpi.completed} />
              <Stat label='Dibatalkan' value={report.data.kpi.cancelled} />
              <Stat label='No-show' value={report.data.kpi.noShow} />
              <Stat
                label='Kedaluwarsa'
                value={report.data.kpi.expiredPending}
              />
              <Stat
                label='Rata-rata tunggu'
                value={`${report.data.kpi.averageWaitingMinutes} mnt`}
              />
              <Stat
                label='Rata-rata proses'
                value={`${report.data.kpi.averageProcessingMinutes} mnt`}
              />
              <Stat
                label='Melewati blok'
                value={report.data.kpi.overrunCount}
                hint='Booking yang prosesnya melampaui blok'
              />
            </CardContent>
          </Card>

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
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey='completed'
                      name='Selesai'
                      fill='var(--chart-2)'
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey='late'
                      name='Terlambat'
                      fill='var(--chart-4)'
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  Kedatangan truk per jam
                </CardTitle>
                <CardDescription>
                  Jumlah truk Anda yang gate-in pada tiap jam operasional.
                </CardDescription>
              </CardHeader>
              <CardContent className='h-72'>
                <ResponsiveContainer width='100%' height='100%'>
                  <BarChart data={report.data.byHour}>
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
                    <Bar
                      dataKey='arrivals'
                      name='Kedatangan'
                      fill='var(--chart-1)'
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
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
              {isMobile ? (
                <BookingList rows={report.data.rows} />
              ) : (
                <DataTable
                  columns={columns}
                  data={report.data.rows}
                  getRowId={(row) => row.bookingCode}
                  emptyMessage='Tidak ada booking pada rentang tanggal ini.'
                />
              )}
            </CardContent>
          </Card>
        </div>
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className='space-y-0.5'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='text-lg font-semibold tabular-nums'>{value}</p>
      {hint && <p className='text-[11px] text-muted-foreground'>{hint}</p>}
    </div>
  )
}

function SlotUsage({ row }: { row: CustomerReportRow }) {
  if (row.slotUsedPercent === null) return <>-</>

  const overrun = row.slotOverrunMinutes ?? 0
  return (
    <span
      className={
        overrun > 0
          ? 'font-medium text-amber-600 dark:text-amber-400'
          : undefined
      }
    >
      {row.slotUsedPercent}%
      {overrun > 0 && (
        <span className='ms-1 text-xs font-normal'>(+{overrun} mnt)</span>
      )}
    </span>
  )
}

/** Daftar ringkas untuk layar ponsel; tabel selebar ini tidak terbaca di 393 px. */
function BookingList({ rows }: { rows: CustomerReportRow[] }) {
  if (rows.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        Tidak ada booking pada rentang tanggal ini.
      </p>
    )
  }

  return (
    <ul className='divide-y overflow-hidden rounded-xl border'>
      {rows.map((row) => (
        <li key={row.bookingCode} className='space-y-2 p-3'>
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <p className='font-mono text-xs'>{row.bookingCode}</p>
              <p className='truncate text-sm'>
                {formatDate(`${row.bookingDate}T00:00:00.000Z`)}
                {row.licensePlate ? ` · ${row.licensePlate}` : ''}
              </p>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <div className='grid grid-cols-4 gap-2'>
            <MobileMetric label='Tunggu' value={row.waitingMinutes} />
            <MobileMetric label='Proses' value={row.processingMinutes} />
            <MobileMetric label='Total' value={row.turnaroundMinutes} />
            <div className='space-y-0.5'>
              <p className='text-[11px] text-muted-foreground'>Slot</p>
              <p className='text-sm font-medium tabular-nums'>
                {row.slotUsedPercent === null ? '-' : `${row.slotUsedPercent}%`}
              </p>
            </div>
          </div>

          {row.lateMinutes > 0 && (
            <p className='text-xs text-amber-600 dark:text-amber-400'>
              Terlambat {row.lateMinutes} menit
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function MobileMetric({
  label,
  value,
}: {
  label: string
  value: number | null
}) {
  return (
    <div className='space-y-0.5'>
      <p className='text-[11px] text-muted-foreground'>{label}</p>
      <p className='text-sm font-medium tabular-nums'>{value ?? '-'}</p>
    </div>
  )
}
