import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { SearchIcon, RefreshCwIcon } from 'lucide-react'
import { fetchGateHistory } from '@/lib/api/endpoints'
import type { GateHistoryEvent, GateHistoryRow } from '@/lib/api/types'
import {
  activityLabels,
  formatDateTime,
  roleLabels,
  todayISO,
} from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'

type Translate = ReturnType<typeof useT>

/**
 * Satu baris = satu peristiwa, bukan satu truk: truk yang masuk pagi dan keluar
 * siang muncul dua kali. Urutannya kronologis terbalik, sehingga kejadian
 * terakhir — yang biasanya ditanyakan orang — ada paling atas.
 *
 * Kolom dibangun di dalam komponen karena judulnya memakai bahasa aktif.
 */
function buildColumns(t: Translate): ColumnDef<GateHistoryRow>[] {
  return [
    {
      accessorKey: 'at',
      meta: {
        label: t('history.col.time'),
        cellClassName: 'text-sm whitespace-nowrap tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('history.col.time')} />
      ),
      cell: ({ row }) => formatDateTime(row.original.at),
    },
    {
      accessorKey: 'event',
      enableGlobalFilter: false,
      meta: { label: t('history.col.event') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('history.col.event')} />
      ),
      cell: ({ row }) => <EventBadge event={row.original.event} />,
    },
    {
      id: 'bookingCode',
      accessorFn: (row) => row.bookingCode ?? '',
      meta: { label: t('history.col.code'), cellClassName: 'font-mono text-xs' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('history.col.code')} />
      ),
      cell: ({ row }) => row.original.bookingCode ?? '—',
    },
    {
      id: 'customer',
      accessorFn: (row) => row.customer ?? '',
      meta: { label: t('history.col.customer'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('history.col.customer')}
        />
      ),
      cell: ({ row }) => row.original.customer ?? '—',
    },
    {
      id: 'vehicle',
      accessorFn: (row) => row.licensePlate ?? '',
      meta: { label: t('history.col.vehicle'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('history.col.vehicle')}
        />
      ),
      cell: ({ row }) => (
        <>
          {row.original.licensePlate ?? '—'}
          {row.original.driverName && (
            <span className='block text-xs text-muted-foreground'>
              {row.original.driverName}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'dock',
      accessorFn: (row) => row.dockCode ?? '',
      meta: { label: t('history.col.dock'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('history.col.dock')} />
      ),
      cell: ({ row }) => (
        <>
          {row.original.dockCode ?? '—'}
          {row.original.activityType && (
            <span className='block text-xs text-muted-foreground'>
              {activityLabels[row.original.activityType]}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'officer',
      accessorFn: (row) => row.officerName ?? '',
      meta: { label: t('history.col.officer'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('history.col.officer')}
        />
      ),
      cell: ({ row }) => (
        <>
          {row.original.officerName ?? '—'}
          {row.original.officerRole && (
            <span className='block text-xs text-muted-foreground'>
              {roleLabels[row.original.officerRole]}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'description',
      enableSorting: false,
      enableGlobalFilter: false,
      meta: {
        label: t('history.col.description'),
        cellClassName: 'max-w-64 text-sm',
      },
      header: () => <span>{t('history.col.description')}</span>,
      cell: ({ row }) => <Description row={row.original} />,
    },
  ]
}

export function GateHistoryPage() {
  useRealtimeSync()
  const t = useT()

  const today = todayISO()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const rangeInvalid = from > to

  const history = useQuery({
    queryKey: ['ops', 'gate-history', from, to, debouncedSearch],
    queryFn: () =>
      fetchGateHistory({ from, to, q: debouncedSearch || undefined }),
    enabled: !rangeInvalid,
  })

  const rows = useMemo(() => history.data?.rows ?? [], [history.data])
  const columns = useMemo(() => buildColumns(t), [t])
  const counts = useMemo(() => {
    return rows.reduce(
      (total, row) => {
        total[row.event] += 1
        return total
      },
      { GATE_IN: 0, GATE_OUT: 0 }
    )
  }, [rows])

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title={t('history.title')}
        description={t('history.description')}
      />

      <Card>
        <CardContent className='flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-end'>
          <div className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground'>
              {t('history.from')}
            </span>
            <DatePicker
              value={from}
              onChange={setFrom}
              max={to}
              className='w-full sm:w-44'
              aria-label={t('history.from')}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground'>
              {t('history.to')}
            </span>
            <DatePicker
              value={to}
              onChange={setTo}
              min={from}
              className='w-full sm:w-44'
              aria-label={t('history.to')}
            />
          </div>
          <div className='flex flex-1 flex-col gap-1.5 sm:min-w-56'>
            <span className='text-xs font-medium text-muted-foreground'>
              {t('history.search')}
            </span>
            <div className='relative'>
              <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('history.searchPlaceholder')}
                className='ps-9'
                aria-label={t('history.searchAria')}
              />
            </div>
          </div>
          <Button
            variant='outline'
            onClick={() => {
              setFrom(today)
              setTo(today)
              setSearch('')
            }}
            disabled={from === today && to === today && search === ''}
          >
            {t('history.today')}
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-11 shrink-0 sm:size-9'
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
            aria-label={t('history.refresh')}
          >
            <RefreshCwIcon
              className={history.isFetching ? 'animate-spin' : undefined}
            />
          </Button>
        </CardContent>
      </Card>

      {rangeInvalid ? (
        <Card>
          <CardContent className='py-10 text-center text-sm text-muted-foreground'>
            {t('history.rangeInvalid')}
          </CardContent>
        </Card>
      ) : history.isPending ? (
        <LoadingBlock label={t('history.loading')} />
      ) : history.isError ? (
        <ErrorBlock
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:gap-4'>
            <Summary label={t('history.event.GATE_IN')} value={counts.GATE_IN} />
            <Summary
              label={t('history.event.GATE_OUT')}
              value={counts.GATE_OUT}
            />
          </div>

          {history.data.truncated && (
            <p className='text-sm text-muted-foreground'>
              {t('history.truncated', { count: rows.length })}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('history.timeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className='py-10 text-center text-sm text-muted-foreground'>
                  <p className='font-medium text-foreground'>
                    {t('history.emptyTitle')}
                  </p>
                  <p className='mt-1'>{t('history.emptyBody')}</p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  getRowId={(row) => row.id}
                  pageSize={20}
                  emptyMessage={t('history.emptyTable')}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Main>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className='space-y-1 px-4 sm:px-6'>
        <p className='text-xs text-muted-foreground sm:text-sm'>{label}</p>
        <p className='text-2xl font-semibold tabular-nums sm:text-3xl'>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function EventBadge({ event }: { event: GateHistoryEvent }) {
  const t = useT()
  return (
    <Badge variant={event === 'GATE_IN' ? 'default' : 'secondary'}>
      {t(`history.event.${event}`)}
    </Badge>
  )
}

function Description({ row }: { row: GateHistoryRow }) {
  const t = useT()
  if (row.event === 'GATE_OUT' && row.minutesInside !== null) {
    return (
      <span className='text-muted-foreground'>
        {t('history.minutesInside', { count: row.minutesInside })}
      </span>
    )
  }
  if (row.gateOutAt) {
    return (
      <span className='text-muted-foreground'>
        {t('history.gateOutAt', { time: formatDateTime(row.gateOutAt) })}
      </span>
    )
  }
  return <span className='text-muted-foreground'>{t('history.stillInside')}</span>
}
