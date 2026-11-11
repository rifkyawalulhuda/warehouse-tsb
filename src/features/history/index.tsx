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

const eventLabels: Record<GateHistoryEvent, string> = {
  GATE_IN: 'Masuk',
  GATE_OUT: 'Keluar',
}

/**
 * Satu baris = satu peristiwa, bukan satu truk: truk yang masuk pagi dan keluar
 * siang muncul dua kali. Urutannya kronologis terbalik, sehingga kejadian
 * terakhir — yang biasanya ditanyakan orang — ada paling atas.
 */
const columns: ColumnDef<GateHistoryRow>[] = [
  {
    accessorKey: 'at',
    meta: {
      label: 'Waktu',
      cellClassName: 'text-sm whitespace-nowrap tabular-nums',
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Waktu' />
    ),
    cell: ({ row }) => formatDateTime(row.original.at),
  },
  {
    accessorKey: 'event',
    enableGlobalFilter: false,
    meta: { label: 'Peristiwa' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Peristiwa' />
    ),
    cell: ({ row }) => <EventBadge event={row.original.event} />,
  },
  {
    id: 'bookingCode',
    accessorFn: (row) => row.bookingCode ?? '',
    meta: { label: 'Kode', cellClassName: 'font-mono text-xs' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kode' />
    ),
    cell: ({ row }) => row.original.bookingCode ?? '—',
  },
  {
    id: 'customer',
    accessorFn: (row) => row.customer ?? '',
    meta: { label: 'Customer', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Customer' />
    ),
    cell: ({ row }) => row.original.customer ?? '—',
  },
  {
    id: 'vehicle',
    accessorFn: (row) => row.licensePlate ?? '',
    meta: { label: 'Kendaraan', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kendaraan' />
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
    meta: { label: 'Dock', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Dock' />
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
    meta: { label: 'Petugas', cellClassName: 'text-sm' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Petugas' />
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
    meta: { label: 'Keterangan', cellClassName: 'max-w-64 text-sm' },
    header: () => <span>Keterangan</span>,
    cell: ({ row }) => <Description row={row.original} />,
  },
]

export function GateHistoryPage() {
  useRealtimeSync()

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
        title='Riwayat Gate'
        description='Truk yang sudah masuk dan keluar gate, dalam urutan kejadian.'
      />

      <Card>
        <CardContent className='flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap sm:items-end'>
          <div className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground'>
              Dari tanggal
            </span>
            <DatePicker
              value={from}
              onChange={setFrom}
              max={to}
              className='w-full sm:w-44'
              aria-label='Tanggal awal'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <span className='text-xs font-medium text-muted-foreground'>
              Sampai tanggal
            </span>
            <DatePicker
              value={to}
              onChange={setTo}
              min={from}
              className='w-full sm:w-44'
              aria-label='Tanggal akhir'
            />
          </div>
          <div className='flex flex-1 flex-col gap-1.5 sm:min-w-56'>
            <span className='text-xs font-medium text-muted-foreground'>
              Cari
            </span>
            <div className='relative'>
              <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder='Kode booking, plat, atau supir'
                className='ps-9'
                aria-label='Cari kode booking, plat nomor, atau nama supir'
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
            Hari ini
          </Button>
          <Button
            variant='outline'
            size='icon'
            className='size-11 shrink-0 sm:size-9'
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
            aria-label='Muat ulang riwayat'
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
            Tanggal awal tidak boleh melewati tanggal akhir.
          </CardContent>
        </Card>
      ) : history.isPending ? (
        <LoadingBlock label='Memuat riwayat gate...' />
      ) : history.isError ? (
        <ErrorBlock
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <>
          <div className='grid grid-cols-2 gap-2 sm:gap-4'>
            <Summary label='Masuk' value={counts.GATE_IN} />
            <Summary label='Keluar' value={counts.GATE_OUT} />
          </div>

          {history.data.truncated && (
            <p className='text-sm text-muted-foreground'>
              Menampilkan {rows.length} peristiwa terbaru. Persempit rentang
              tanggal untuk melihat sisanya — angka di atas hanya menghitung
              baris yang tampil.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>Kronologi</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className='py-10 text-center text-sm text-muted-foreground'>
                  <p className='font-medium text-foreground'>
                    Belum ada aktivitas gate
                  </p>
                  <p className='mt-1'>
                    Tidak ada truk yang masuk atau keluar pada rentang ini.
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={rows}
                  getRowId={(row) => row.id}
                  pageSize={20}
                  emptyMessage='Tidak ada peristiwa gate pada rentang ini.'
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
  return (
    <Badge variant={event === 'GATE_IN' ? 'default' : 'secondary'}>
      {eventLabels[event]}
    </Badge>
  )
}

function Description({ row }: { row: GateHistoryRow }) {
  if (row.event === 'GATE_OUT' && row.minutesInside !== null) {
    return (
      <span className='text-muted-foreground'>
        {row.minutesInside} menit di dalam
      </span>
    )
  }
  if (row.gateOutAt) {
    return (
      <span className='text-muted-foreground'>
        Keluar {formatDateTime(row.gateOutAt)}
      </span>
    )
  }
  return <span className='text-muted-foreground'>Masih di dalam</span>
}
