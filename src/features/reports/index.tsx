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
import {
  fetchCustomerOptions,
  fetchKpi,
  reportExportUrl,
} from '@/lib/api/endpoints'
import type { ReportRow } from '@/lib/api/types'
import { addDaysISO, formatDateShort, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
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

/** Rentang cepat dalam jumlah hari ke belakang, termasuk hari ini. */
const rangePresets = [
  { label: 'Hari ini', days: 0 },
  { label: '7 hari', days: 6 },
  { label: '30 hari', days: 29 },
] as const

/** Rentang bawaan sekaligus tujuan tombol "Atur ulang": tujuh hari terakhir. */
const DEFAULT_RANGE_DAYS = 6

export function ReportsPage() {
  useRealtimeSync()
  const today = todayISO()
  const defaultFrom = addDaysISO(today, -DEFAULT_RANGE_DAYS)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)
  const [customerId, setCustomerId] = useState('ALL')

  const rangeInvalid = from > to
  const customerParam = customerId === 'ALL' ? undefined : customerId
  const isDefaultRange = from === defaultFrom && to === today

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: fetchCustomerOptions,
  })

  const report = useQuery({
    queryKey: ['reports', from, to, customerId],
    queryFn: () =>
      fetchKpi(from, to, customerId === 'ALL' ? undefined : customerId),
    enabled: !rangeInvalid,
    // Ganti tanggal bukan alasan mengosongkan layar: KPI dan grafik lama tetap
    // tampil sampai respons baru datang, supaya tidak ada kedipan loading.
    placeholderData: keepPreviousData,
  })

  const applyPreset = (days: number) => {
    setFrom(addDaysISO(today, -days))
    setTo(today)
  }

  const resetFilters = () => {
    setFrom(defaultFrom)
    setTo(today)
    setCustomerId('ALL')
  }

  // Label pemicu dropdown disiapkan di sini karena `SelectValue` dengan
  // children tidak lagi menurunkan teks dari item yang sedang terpilih.
  const selectedName =
    customerId === 'ALL'
      ? 'Semua customer'
      : ((customers.data ?? []).find((item) => item.id === customerId)?.name ??
        'Semua customer')

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Laporan'
        description='KPI operasional dan rekapitulasi per hari dalam rentang tanggal.'
      />

      <Card>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='report-from'
                className='text-xs font-medium text-muted-foreground'
              >
                Dari tanggal
              </Label>
              <DatePicker
                id='report-from'
                value={from}
                max={to}
                onChange={setFrom}
                className='w-full sm:w-44'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='report-to'
                className='text-xs font-medium text-muted-foreground'
              >
                Sampai tanggal
              </Label>
              <DatePicker
                id='report-to'
                value={to}
                min={from}
                max={today}
                onChange={setTo}
                className='w-full sm:w-44'
              />
            </div>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='report-customer'
                className='text-xs font-medium text-muted-foreground'
              >
                Customer
              </Label>
              <Select
                value={customerId}
                onValueChange={setCustomerId}
                disabled={customers.isPending}
              >
                <SelectTrigger id='report-customer' className='w-full sm:w-56'>
                  {/*
                    Nilai select selalu terisi ('ALL' atau id customer), jadi
                    `placeholder` tidak pernah tampil. Keadaan memuat ditulis
                    sebagai children supaya tetap terlihat.
                  */}
                  <SelectValue>
                    {customers.isPending ? 'Memuat customer...' : selectedName}
                  </SelectValue>
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
              {customers.isError && (
                <p className='text-xs text-destructive'>
                  Daftar customer gagal dimuat.
                </p>
              )}
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
                dirender ketika data untuk rentang yang sedang dipilih sudah
                benar-benar ada. Selama data lama masih ditampilkan
                (`isPlaceholderData`), tombolnya mati agar unduhan tidak
                memakai rentang yang hasilnya belum masuk.
              */}
              {report.data && !report.isPlaceholderData ? (
                <Button asChild variant='outline'>
                  <a href={reportExportUrl(from, to, customerParam)} download>
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
              disabled={isDefaultRange && customerId === 'ALL'}
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
        <LoadingBlock label='Menghitung KPI...' />
      ) : report.isError ? (
        <ErrorBlock
          error={report.error}
          onRetry={() => void report.refetch()}
        />
      ) : (
        /*
          Saat rentang diganti, `placeholderData` menahan hasil sebelumnya di
          layar. `aria-busy` dan peredupan halus hanya menandai keadaan itu —
          bukan setiap penyegaran latar dari realtime, yang kalau ikut meredup
          akan membuat halaman berkedip terus.
        */
        <div
          aria-busy={report.isPlaceholderData}
          className={cn(
            'flex flex-col gap-6 transition-opacity',
            report.isPlaceholderData && 'opacity-60'
          )}
        >
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
