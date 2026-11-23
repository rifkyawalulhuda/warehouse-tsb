import { useMemo, useState } from 'react'
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
import { useLocale, useT, type MessageKey, type Vars } from '@/lib/i18n'
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
function buildColumns(
  t: (key: MessageKey, vars?: Vars) => string
): ColumnDef<CustomerReportRow>[] {
  return [
    {
      accessorKey: 'bookingCode',
      meta: { label: t('report.col.code'), cellClassName: 'font-mono text-xs' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.code')} />
      ),
    },
    {
      id: 'bookingDate',
      accessorFn: (row) => row.bookingDate,
      meta: { label: t('report.col.date'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.date')} />
      ),
      cell: ({ row }) => formatDate(`${row.original.bookingDate}T00:00:00.000Z`),
    },
    {
      id: 'licensePlate',
      accessorFn: (row) => row.licensePlate ?? '',
      meta: { label: t('report.col.plate'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.plate')} />
      ),
      cell: ({ row }) => row.original.licensePlate ?? '-',
    },
    {
      id: 'dockCode',
      accessorFn: (row) => row.dockCode ?? '',
      meta: { label: t('report.col.dock'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.dock')} />
      ),
      cell: ({ row }) =>
        row.original.dockCode ? (
          <>
            {row.original.dockCode}
            {row.original.dockAreaName ? (
              <span className='block text-xs text-muted-foreground'>
                {row.original.dockAreaName}
              </span>
            ) : null}
          </>
        ) : (
          '-'
        ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.status,
      enableGlobalFilter: false,
      meta: { label: t('report.col.status') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.status')} />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'waitingMinutes',
      accessorFn: (row) => row.waitingMinutes ?? undefined,
      meta: {
        label: t('report.col.waiting'),
        headerClassName: 'text-end',
        cellClassName: 'text-end text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.waiting')} />
      ),
      cell: ({ row }) => row.original.waitingMinutes ?? '-',
    },
    {
      id: 'processingMinutes',
      accessorFn: (row) => row.processingMinutes ?? undefined,
      meta: {
        label: t('report.col.processing'),
        headerClassName: 'text-end',
        cellClassName: 'text-end text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.processing')} />
      ),
      cell: ({ row }) => row.original.processingMinutes ?? '-',
    },
    {
      id: 'turnaroundMinutes',
      accessorFn: (row) => row.turnaroundMinutes ?? undefined,
      meta: {
        label: t('report.col.turnaround'),
        headerClassName: 'text-end',
        cellClassName: 'text-end text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.turnaround')} />
      ),
      cell: ({ row }) => row.original.turnaroundMinutes ?? '-',
    },
    {
      id: 'lateMinutes',
      accessorFn: (row) => (row.lateMinutes > 0 ? row.lateMinutes : undefined),
      meta: {
        label: t('report.col.late'),
        headerClassName: 'text-end',
        cellClassName: 'text-end text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.late')} />
      ),
      cell: ({ row }) =>
        row.original.lateMinutes > 0 ? row.original.lateMinutes : '-',
    },
    {
      id: 'slotUsedPercent',
      accessorFn: (row) => row.slotUsedPercent ?? undefined,
      meta: {
        label: t('report.col.slot'),
        headerClassName: 'text-end',
        cellClassName: 'text-end text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('report.col.slot')} />
      ),
      cell: ({ row }) => <SlotUsage row={row.original} />,
    },
  ]
}
const RANGE_PRESETS = [
  { key: 'report.presetToday', days: 0 },
  { key: 'report.preset7', days: 6 },
  { key: 'report.preset30', days: 29 },
] as const

const DEFAULT_RANGE_DAYS = 6

export function CustomerReportsPage() {
  useRealtimeSync()
  const isMobile = useIsMobile()
  const company = useCustomerName()
  const t = useT()
  const locale = useLocale()
  const columns = useMemo(() => buildColumns(t), [t])
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
        title={t('report.title')}
        description={t('report.description')}
      />

      <Card>
        <CardContent className='flex flex-col gap-4 pt-6'>
          <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end'>
            <div className='flex flex-col gap-1.5'>
              <Label
                htmlFor='my-report-from'
                className='text-xs font-medium text-muted-foreground'
              >
                {t('report.from')}
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
                {t('report.to')}
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
                aria-label={t('report.reload')}
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
                  <a href={myReportExportUrl(from, to, locale)} download>
                    <Download /> {t('report.export')}
                  </a>
                </Button>
              ) : (
                <Button variant='outline' disabled>
                  <Download /> {t('report.export')}
                </Button>
              )}
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <div
              role='group'
              aria-label={t('report.presets')}
              className='flex flex-wrap items-center gap-2'
            >
              {RANGE_PRESETS.map((preset) => {
                const presetFrom = addDaysISO(today, -preset.days)
                const active = from === presetFrom && to === today
                return (
                  <Button
                    key={preset.key}
                    variant={active ? 'secondary' : 'outline'}
                    aria-pressed={active}
                    onClick={() => applyPreset(preset.days)}
                  >
                    {t(preset.key)}
                  </Button>
                )
              })}
            </div>
            <Button
              variant='ghost'
              onClick={resetFilters}
              disabled={isDefaultRange}
            >
              {t('report.reset')}
            </Button>
            <span
              role='status'
              aria-live='polite'
              className='text-xs text-muted-foreground'
            >
              {report.isPlaceholderData ? t('report.updating') : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {rangeInvalid ? (
        <p className='text-sm text-destructive'>{t('report.rangeInvalid')}</p>
      ) : report.isPending ? (
        <LoadingBlock label={t('report.calculating')} />
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
                label={t('report.kpi.total')}
                value={report.data.kpi.totalBookings}
              />
              <Kpi
                label={t('report.kpi.onTime')}
                value={`${report.data.kpi.onTimeRate}%`}
                hint={t('report.kpi.onTimeHint')}
              />
              <Kpi
                label={t('report.kpi.turnaround')}
                value={t('report.minutes', {
                  count: report.data.kpi.averageTurnaroundMinutes,
                })}
                hint={t('report.kpi.turnaroundHint')}
              />
              <Kpi
                label={t('report.kpi.slot')}
                value={`${report.data.kpi.averageSlotUsedPercent}%`}
                hint={t('report.kpi.slotHint')}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                {t('report.section.detail')}
              </CardTitle>
              <CardDescription>
                {t('report.section.detailDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className='grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-7'>
              <Stat
                label={t('report.completed')}
                value={report.data.kpi.completed}
              />
              <Stat
                label={t('report.cancelled')}
                value={report.data.kpi.cancelled}
              />
              <Stat label={t('report.noShow')} value={report.data.kpi.noShow} />
              <Stat
                label={t('report.expired')}
                value={report.data.kpi.expiredPending}
              />
              <Stat
                label={t('report.avgWaiting')}
                value={t('report.minutes', {
                  count: report.data.kpi.averageWaitingMinutes,
                })}
              />
              <Stat
                label={t('report.avgProcessing')}
                value={t('report.minutes', {
                  count: report.data.kpi.averageProcessingMinutes,
                })}
              />
              <Stat
                label={t('report.overrun')}
                value={report.data.kpi.overrunCount}
                hint={t('report.overrunHint')}
              />
            </CardContent>
          </Card>

          <div className='grid gap-4 xl:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>{t('report.byDay')}</CardTitle>
                <CardDescription>{t('report.byDayDesc')}</CardDescription>
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
                      name={t('report.legend.total')}
                      fill='var(--chart-1)'
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey='completed'
                      name={t('report.legend.completed')}
                      fill='var(--chart-2)'
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey='late'
                      name={t('report.legend.late')}
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
                  {t('report.byHour')}
                </CardTitle>
                <CardDescription>{t('report.byHourDesc')}</CardDescription>
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
                      name={t('report.legend.arrivals')}
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
              <CardTitle className='text-base'>{t('report.table')}</CardTitle>
              <CardDescription>
                {t('report.tableDesc', { count: report.data.rows.length })}
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
                  emptyMessage={t('report.empty')}
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
  const t = useT()
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
        <span className='ms-1 text-xs font-normal'>
          {t('report.overrunBy', { count: overrun })}
        </span>
      )}
    </span>
  )
}

/** Daftar ringkas untuk layar ponsel; tabel selebar ini tidak terbaca di 393 px. */
function BookingList({ rows }: { rows: CustomerReportRow[] }) {
  const t = useT()

  if (rows.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-muted-foreground'>
        {t('report.empty')}
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
            <MobileMetric
              label={t('report.col.waiting')}
              value={row.waitingMinutes}
            />
            <MobileMetric
              label={t('report.col.processing')}
              value={row.processingMinutes}
            />
            <MobileMetric
              label={t('report.total')}
              value={row.turnaroundMinutes}
            />
            <div className='space-y-0.5'>
              <p className='text-[11px] text-muted-foreground'>
                {t('report.col.slot')}
              </p>
              <p className='text-sm font-medium tabular-nums'>
                {row.slotUsedPercent === null ? '-' : `${row.slotUsedPercent}%`}
              </p>
            </div>
          </div>

          {row.lateMinutes > 0 && (
            <p className='text-xs text-amber-600 dark:text-amber-400'>
              {t('report.lateNotice', { count: row.lateMinutes })}
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
