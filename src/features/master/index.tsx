import { useMemo, useState, type ReactNode } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowDownUp,
  Building2,
  ClipboardList,
  Factory,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Truck,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createDock,
  createTruckType,
  createWarehouse,
  fetchCustomers,
  fetchDocks,
  fetchSettings,
  fetchTruckTypes,
  fetchWarehouses,
  updateDock,
  updateTruckType,
  updateWarehouse,
} from '@/lib/api/endpoints'
import type { Customer, Dock, TruckType, Warehouse } from '@/lib/api/types'
import { durationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { CustomerDialog, CustomerSection } from './customer-section'

/**
 * Kapasitas kuota tidak diatur manual di sini. Kuota per slot adalah jumlah dock
 * aktif yang mengizinkan aktivitas tersebut, jadi mengubah daftar dock berarti
 * mengubah kapasitas — satu sumber kebenaran, tidak ada dua angka yang bisa
 * saling bertentangan.
 */
export function MasterData() {
  useRealtimeSync()
  const queryClient = useQueryClient()

  const docks = useQuery({ queryKey: ['master', 'docks'], queryFn: fetchDocks })
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const warehouses = useQuery({
    queryKey: ['master', 'warehouses'],
    queryFn: fetchWarehouses,
  })
  const truckTypes = useQuery({
    queryKey: ['master', 'truck-types'],
    queryFn: fetchTruckTypes,
  })
  const customers = useQuery({
    queryKey: ['master', 'customers'],
    queryFn: () => fetchCustomers(),
  })

  const [editingDock, setEditingDock] = useState<Dock | null>(null)
  const [creatingDock, setCreatingDock] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(
    null
  )
  const [creatingWarehouse, setCreatingWarehouse] = useState(false)
  const [editingTruckType, setEditingTruckType] = useState<TruckType | null>(
    null
  )
  const [creatingTruckType, setCreatingTruckType] = useState(false)
  // `undefined` = dialog tertutup; `null` = membuat baru; objek = mengubah.
  const [customerDialog, setCustomerDialog] = useState<
    Customer | null | undefined
  >(undefined)

  const refreshMaster = () => {
    void queryClient.invalidateQueries({ queryKey: ['master'] })
    void queryClient.invalidateQueries({ queryKey: ['ops'] })
  }

  const refreshTruckTypes = () => {
    refreshMaster()
    void queryClient.invalidateQueries({ queryKey: ['settings'] })
    // Kuota yang ditawarkan ke customer berubah mengikuti jenis truk.
    void queryClient.invalidateQueries({ queryKey: ['availability'] })
  }

  const toggleDock = useMutation({
    mutationFn: ({
      dock,
      status,
    }: {
      dock: Dock
      status: Dock['currentStatus']
    }) => updateDock(dock.id, { currentStatus: status }),
    onSuccess: () => {
      toast.success('Status dock diperbarui')
      refreshMaster()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const summary = useMemo(() => {
    const all = docks.data?.docks ?? []
    const capacities = docks.data?.capacities
    return {
      docksActive: all.filter((dock) => dock.currentStatus !== 'MAINTENANCE')
        .length,
      docksTotal: all.length,
      loading: capacities?.LOADING ?? 0,
      unloading: capacities?.UNLOADING ?? 0,
      truckTypesActive:
        truckTypes.data?.filter((type) => type.isActive).length ?? 0,
      truckTypesTotal: truckTypes.data?.length ?? 0,
      warehouseCount: warehouses.data?.length ?? 0,
      customersActive:
        customers.data?.filter((customer) => customer.isActive).length ?? 0,
      customersTotal: customers.data?.length ?? 0,
    }
  }, [docks.data, truckTypes.data, warehouses.data, customers.data])

  const slotUnitMinutes = settings.data?.slotUnitMinutes ?? 30

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Master Data'
        description='Dock menentukan kapasitas per slot. Jenis truk menentukan durasi blok.'
      />

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard
          icon={Building2}
          label='Dock siap pakai'
          value={`${summary.docksActive}`}
          unit={`dari ${summary.docksTotal}`}
          hint={
            summary.docksTotal - summary.docksActive > 0
              ? `${summary.docksTotal - summary.docksActive} sedang perawatan`
              : 'Semua dock siap menerima truk'
          }
          tone='sky'
        />
        <SummaryCard
          icon={WarehouseIcon}
          label='Kapasitas loading'
          value={`${summary.loading}`}
          unit='truk / slot'
          hint='Jumlah dock aktif yang melayani loading'
          tone='indigo'
        />
        <SummaryCard
          icon={WarehouseIcon}
          label='Kapasitas unloading'
          value={`${summary.unloading}`}
          unit='truk / slot'
          hint='Jumlah dock aktif yang melayani unloading'
          tone='violet'
        />
        <SummaryCard
          icon={Truck}
          label='Jenis truk aktif'
          value={`${summary.truckTypesActive}`}
          unit={`dari ${summary.truckTypesTotal}`}
          hint={
            summary.truckTypesActive === 0
              ? 'Customer tidak bisa booking sampai satu jenis diaktifkan'
              : 'Tersedia di form booking customer'
          }
          tone={summary.truckTypesActive === 0 ? 'amber' : 'emerald'}
        />
      </div>

      <Tabs defaultValue='docks' className='gap-4'>
        <TabsList>
          <TabsTrigger value='docks'>
            <ClipboardList />
            Dock
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.docksTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='warehouses'>
            <WarehouseIcon />
            Gudang
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.warehouseCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='truck-types'>
            <Truck />
            Jenis Truk
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.truckTypesTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='customers'>
            <Factory />
            Customer
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.customersTotal}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value='docks'>
          <DockSection
            query={docks}
            warehouses={warehouses.data ?? []}
            onToggle={toggleDock.mutate}
            toggling={toggleDock.isPending}
            onEdit={setEditingDock}
            onCreate={() => setCreatingDock(true)}
          />
        </TabsContent>

        <TabsContent value='warehouses'>
          <WarehouseSection
            query={warehouses}
            onEdit={setEditingWarehouse}
            onCreate={() => setCreatingWarehouse(true)}
          />
        </TabsContent>

        <TabsContent value='truck-types'>
          <TruckTypeSection
            query={truckTypes}
            onEdit={setEditingTruckType}
            onCreate={() => setCreatingTruckType(true)}
          />
        </TabsContent>

        <TabsContent value='customers'>
          <CustomerSection
            onEdit={(customer) => setCustomerDialog(customer)}
            onCreate={() => setCustomerDialog(null)}
          />
        </TabsContent>
      </Tabs>

      {customerDialog !== undefined && (
        <CustomerDialog
          key={customerDialog?.id ?? 'new'}
          customer={customerDialog}
          onDone={() => setCustomerDialog(undefined)}
        />
      )}

      {(editingDock || creatingDock) && (
        <DockDialog
          key={editingDock?.id ?? 'new'}
          dock={editingDock}
          warehouses={warehouses.data ?? []}
          onDone={() => {
            setEditingDock(null)
            setCreatingDock(false)
          }}
          onChanged={refreshMaster}
        />
      )}

      {(editingWarehouse || creatingWarehouse) && (
        <WarehouseDialog
          key={editingWarehouse?.id ?? 'new'}
          warehouse={editingWarehouse}
          onDone={() => {
            setEditingWarehouse(null)
            setCreatingWarehouse(false)
          }}
          onChanged={refreshMaster}
        />
      )}

      {(editingTruckType || creatingTruckType) && (
        <TruckTypeDialog
          key={editingTruckType?.id ?? 'new'}
          type={editingTruckType}
          slotUnitMinutes={slotUnitMinutes}
          onDone={() => {
            setEditingTruckType(null)
            setCreatingTruckType(false)
          }}
          onChanged={refreshTruckTypes}
        />
      )}
    </Main>
  )
}

const summaryTone = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  indigo:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  violet:
    'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  emerald:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
} as const

function SummaryCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  unit: string
  hint: string
  tone: keyof typeof summaryTone
}) {
  return (
    <Card className='gap-2 py-4'>
      <CardContent className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <p className='truncate text-sm font-medium text-muted-foreground'>
            {label}
          </p>
          <p className='flex items-baseline gap-1'>
            <span className='text-2xl font-semibold tabular-nums'>{value}</span>
            <span className='text-xs font-medium text-muted-foreground'>
              {unit}
            </span>
          </p>
          <p className='line-clamp-2 text-[11px] text-muted-foreground'>
            {hint}
          </p>
        </div>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            summaryTone[tone]
          )}
        >
          <Icon className='size-4.5' />
        </span>
      </CardContent>
    </Card>
  )
}

/** Toolbar seragam untuk ketiga tab: pencarian di kiri, aksi utama di kanan. */
function SectionToolbar({
  search,
  onSearch,
  placeholder,
  actionLabel,
  onAction,
  children,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  actionLabel: string
  onAction: () => void
  children?: ReactNode
}) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative w-full sm:max-w-xs'>
          <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className='pl-8'
            aria-label={placeholder}
          />
        </div>
        {children}
      </div>
      <Button onClick={onAction} className='sm:shrink-0'>
        <Plus />
        {actionLabel}
      </Button>
    </div>
  )
}

function DockSection({
  query,
  warehouses,
  onToggle,
  toggling,
  onEdit,
  onCreate,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof fetchDocks>>>
  warehouses: Warehouse[]
  onToggle: (payload: { dock: Dock; status: Dock['currentStatus'] }) => void
  toggling: boolean
  onEdit: (dock: Dock) => void
  onCreate: () => void
}) {
  const [search, setSearch] = useState('')
  const [activity, setActivity] = useState<'ALL' | Dock['allowedActivity']>(
    'ALL'
  )

  const docks = query.data?.docks
  const capacities = query.data?.capacities

  // Daftar dock berukuran kecil (belasan), jadi penyaringan langsung lebih
  // sederhana daripada useMemo dan tidak menambah ketergantungan yang tidak stabil.
  const term = search.trim().toLowerCase()
  const filtered = (docks ?? []).filter((dock) => {
    const matchesTerm =
      term === '' ||
      dock.dockCode.toLowerCase().includes(term) ||
      (dock.areaName ?? '').toLowerCase().includes(term) ||
      (dock.warehouse?.name ?? '').toLowerCase().includes(term)
    const matchesActivity =
      activity === 'ALL' || dock.allowedActivity === activity
    return matchesTerm && matchesActivity
  })

  /**
   * Baris dikelompokkan per gudang hanya kalau gudangnya lebih dari satu.
   * Dengan satu gudang, pengelompokan hanya menambah judul tanpa informasi.
   */
  const grouped = (() => {
    if (warehouses.length <= 1) return null
    const map = new Map<string, Dock[]>()
    for (const dock of filtered) {
      const key = dock.warehouse?.name ?? 'Tanpa gudang'
      const bucket = map.get(key)
      if (bucket) bucket.push(dock)
      else map.set(key, [dock])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  })()

  const dockColumns: ColumnDef<Dock>[] = [
    {
      accessorKey: 'dockCode',
      meta: { label: 'Kode', cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Kode' />
      ),
    },
    {
      id: 'areaName',
      accessorFn: (dock) => dock.areaName ?? '',
      meta: { label: 'Nama Area', cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Nama Area' />
      ),
      cell: ({ row }) =>
        row.original.areaName || (
          <span className='text-muted-foreground'>Belum diisi</span>
        ),
    },
    {
      id: 'warehouse',
      accessorFn: (dock) => dock.warehouse?.name ?? '',
      meta: { label: 'Warehouse', cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Warehouse' />
      ),
      cell: ({ row }) => row.original.warehouse?.name ?? '—',
    },
    {
      id: 'activity',
      accessorFn: (dock) => dock.allowedActivity,
      enableGlobalFilter: false,
      meta: { label: 'Melayani' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Melayani' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-wrap gap-1'>
          {(row.original.allowedActivity === 'BOTH'
            ? ['LOADING', 'UNLOADING']
            : [row.original.allowedActivity]
          ).map((item) => (
            <Badge key={item} variant='outline' className='font-normal'>
              {item === 'LOADING' ? 'Loading' : 'Unloading'}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      accessorFn: (dock) => dock.currentStatus,
      enableGlobalFilter: false,
      meta: { label: 'Status' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) =>
        row.original.currentStatus === 'OCCUPIED' ? (
          <div className='flex items-center gap-2'>
            <Badge
              variant='outline'
              className='border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
            >
              Terpakai
            </Badge>
            <span className='text-xs text-muted-foreground'>
              dikunci booking aktif
            </span>
          </div>
        ) : (
          <label className='flex cursor-pointer items-center gap-2'>
            <Switch
              checked={row.original.currentStatus === 'AVAILABLE'}
              disabled={toggling}
              onCheckedChange={(checked) =>
                onToggle({
                  dock: row.original,
                  status: checked ? 'AVAILABLE' : 'MAINTENANCE',
                })
              }
              aria-label={`Status ${row.original.dockCode}, ${row.original.currentStatus === 'AVAILABLE' ? 'tersedia' : 'perawatan'}`}
            />
            <span className='text-sm'>
              {row.original.currentStatus === 'AVAILABLE'
                ? 'Tersedia'
                : 'Perawatan'}
            </span>
          </label>
        ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: 'Aksi',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>Aksi</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          Ubah
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Dock</CardTitle>
        <CardDescription>
          {capacities
            ? `Kapasitas per slot: ${capacities.LOADING} loading, ${capacities.UNLOADING} unloading.`
            : 'Memuat kapasitas...'}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder='Cari kode, area, atau gudang'
          actionLabel='Tambah dock'
          onAction={onCreate}
        >
          <Select
            value={activity}
            onValueChange={(value) => setActivity(value as typeof activity)}
          >
            <SelectTrigger
              className='w-full sm:w-44'
              aria-label='Filter aktivitas'
            >
              <ArrowDownUp className='size-4 text-muted-foreground' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>Semua aktivitas</SelectItem>
              <SelectItem value='LOADING'>Loading</SelectItem>
              <SelectItem value='UNLOADING'>Unloading</SelectItem>
              <SelectItem value='BOTH'>Loading & Unloading</SelectItem>
            </SelectContent>
          </Select>
        </SectionToolbar>

        {query.isPending ? (
          <LoadingBlock label='Memuat dock...' />
        ) : query.isError ? (
          <ErrorBlock
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            {/* Desktop: tabel penuh. Mobile: kartu, karena 6 kolom tidak terbaca. */}
            <div className='hidden md:block'>
              <DataTable
                columns={dockColumns}
                data={filtered}
                getRowId={(dock) => String(dock.id)}
                groupBy={
                  grouped
                    ? (dock) => dock.warehouse?.name ?? 'Tanpa gudang'
                    : undefined
                }
                groupLabel={(name, count) => (
                  <>
                    <WarehouseIcon className='size-3.5' />
                    {name}
                    <span className='tabular-nums'>({count})</span>
                  </>
                )}
                emptyMessage={
                  (docks?.length ?? 0) === 0
                    ? 'Belum ada dock. Tambahkan satu supaya booking bisa diparkir.'
                    : 'Tidak ada dock yang cocok dengan pencarian.'
                }
              />
            </div>

            <div className='space-y-2 md:hidden'>
              {filtered.map((dock) => (
                <div key={dock.id} className='rounded-lg border p-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium'>{dock.dockCode}</p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {dock.areaName || 'Area belum diisi'} ·{' '}
                        {dock.warehouse?.name ?? '—'}
                      </p>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => onEdit(dock)}
                    >
                      <PencilLine />
                      Ubah
                    </Button>
                  </div>
                  <div className='mt-2 flex flex-wrap items-center gap-2'>
                    {(dock.allowedActivity === 'BOTH'
                      ? ['LOADING', 'UNLOADING']
                      : [dock.allowedActivity]
                    ).map((item) => (
                      <Badge
                        key={item}
                        variant='outline'
                        className='font-normal'
                      >
                        {item === 'LOADING' ? 'Loading' : 'Unloading'}
                      </Badge>
                    ))}
                    {dock.currentStatus === 'OCCUPIED' ? (
                      <Badge
                        variant='outline'
                        className='border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
                      >
                        Terpakai
                      </Badge>
                    ) : (
                      <label className='flex cursor-pointer items-center gap-1.5'>
                        <Switch
                          checked={dock.currentStatus === 'AVAILABLE'}
                          disabled={toggling}
                          onCheckedChange={(checked) =>
                            onToggle({
                              dock,
                              status: checked ? 'AVAILABLE' : 'MAINTENANCE',
                            })
                          }
                          aria-label={`Status ${dock.dockCode}`}
                        />
                        <span className='text-xs'>
                          {dock.currentStatus === 'AVAILABLE'
                            ? 'Tersedia'
                            : 'Perawatan'}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  {(docks?.length ?? 0) === 0
                    ? 'Belum ada dock.'
                    : 'Tidak ada dock yang cocok dengan pencarian.'}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Jenis truk diambil dari `/api/master/truck-types`, bukan `/api/settings`.
 * Settings hanya mengembalikan yang `isActive`, jadi memakai settings akan
 * membuat jenis truk yang dinonaktifkan hilang dari layar dan mustahil
 * diaktifkan kembali.
 */
function TruckTypeSection({
  query,
  onEdit,
  onCreate,
}: {
  query: UseQueryResult<TruckType[]>
  onEdit: (type: TruckType) => void
  onCreate: () => void
}) {
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)

  const types = query.data
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (types ?? []).filter((type) => {
      const matchesTerm =
        term === '' || type.truckName.toLowerCase().includes(term)
      const matchesActive = !onlyActive || type.isActive
      return matchesTerm && matchesActive
    })
  }, [types, search, onlyActive])

  const activeCount = (types ?? []).filter((type) => type.isActive).length

  const truckTypeColumns: ColumnDef<TruckType>[] = [
    {
      accessorKey: 'truckName',
      meta: { label: 'Jenis', cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Jenis' />
      ),
    },
    {
      accessorKey: 'durationMinutes',
      meta: { label: 'Durasi' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Durasi' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-wrap items-center gap-1.5 text-sm'>
          {durationLabel(row.original.durationMinutes)}
          <Badge variant='secondary' className='font-normal tabular-nums'>
            {row.original.blocksRequired} blok
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'sortOrder',
      meta: {
        label: 'Urutan',
        cellClassName: 'text-sm tabular-nums text-muted-foreground',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Urutan' />
      ),
    },
    {
      id: 'status',
      accessorFn: (type) => type.isActive,
      enableGlobalFilter: false,
      meta: { label: 'Status' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) => (
        <Badge
          variant='outline'
          className={
            row.original.isActive
              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
              : 'border-border text-muted-foreground'
          }
        >
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: 'Aksi',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>Aksi</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          Ubah
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Jenis truk</CardTitle>
        <CardDescription>
          Durasi menentukan berapa blok yang dikunci satu booking. Jumlah blok
          dihitung server dari durasi, sehingga angkanya tidak bisa berbeda dari
          yang dipakai mesin kuota.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder='Cari jenis truk'
          actionLabel='Tambah jenis truk'
          onAction={onCreate}
        >
          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <Switch
              checked={onlyActive}
              onCheckedChange={setOnlyActive}
              aria-label='Hanya tampilkan yang aktif'
            />
            Hanya aktif
          </label>
        </SectionToolbar>

        {query.data && activeCount === 0 && (
          <p className='rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'>
            Tidak ada jenis truk aktif. Customer tidak bisa membuat booking
            sampai minimal satu jenis diaktifkan kembali.
          </p>
        )}

        {query.isPending ? (
          <LoadingBlock label='Memuat jenis truk...' />
        ) : query.isError ? (
          <ErrorBlock
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            columns={truckTypeColumns}
            data={filtered}
            getRowId={(type) => String(type.id)}
            emptyMessage={
              (types?.length ?? 0) === 0
                ? 'Belum ada jenis truk.'
                : 'Tidak ada jenis truk yang cocok dengan pencarian.'
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Dialog ubah/tambah jenis truk. `key` di pemanggilnya membuat state form
 * disegarkan tiap baris dibuka, jadi tidak ada nilai yang nyangkut dari jenis
 * truk sebelumnya.
 */
function TruckTypeDialog({
  type,
  slotUnitMinutes,
  onDone,
  onChanged,
}: {
  type: TruckType | null
  slotUnitMinutes: number
  onDone: () => void
  onChanged: () => void
}) {
  const creating = type === null
  const [truckName, setTruckName] = useState(type?.truckName ?? '')
  const [duration, setDuration] = useState(String(type?.durationMinutes ?? 60))
  const [sortOrder, setSortOrder] = useState(String(type?.sortOrder ?? 1))
  const [isActive, setIsActive] = useState(type?.isActive ?? true)

  const minutes = Number(duration)
  const blocks = minutes > 0 ? Math.ceil(minutes / slotUnitMinutes) : 0
  const valid =
    truckName.trim().length >= 2 &&
    Number.isInteger(minutes) &&
    minutes >= 30 &&
    blocks >= 1 &&
    Number.isInteger(Number(sortOrder))

  const dirty =
    creating ||
    truckName.trim() !== type.truckName ||
    minutes !== type.durationMinutes ||
    Number(sortOrder) !== type.sortOrder ||
    isActive !== type.isActive

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        truckName: truckName.trim(),
        durationMinutes: minutes,
        sortOrder: Number(sortOrder),
        isActive,
      }
      return creating
        ? createTruckType(payload)
        : updateTruckType(type.id, payload)
    },
    onSuccess: () => {
      toast.success(
        creating ? 'Jenis truk ditambahkan' : 'Jenis truk diperbarui'
      )
      onChanged()
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDone()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {creating ? 'Tambah jenis truk' : 'Ubah jenis truk'}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? 'Jenis truk baru langsung tersedia di form booking customer.'
              : 'Perubahan hanya berlaku untuk booking berikutnya. Booking yang sudah ada tetap memakai jumlah blok yang dikunci saat dibuat.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='truck-type-name'>Nama jenis truk</Label>
            <Input
              id='truck-type-name'
              value={truckName}
              onChange={(event) => setTruckName(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='truck-type-duration'>Durasi (menit)</Label>
              <Input
                id='truck-type-duration'
                type='number'
                min={30}
                step={slotUnitMinutes}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='truck-type-sort'>Urutan tampil</Label>
              <Input
                id='truck-type-sort'
                type='number'
                min={0}
                max={99}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
          </div>

          <p className='text-sm text-muted-foreground'>
            {blocks > 0
              ? `Durasi ${durationLabel(minutes)} = ${blocks} blok.`
              : 'Isi durasi minimal 30 menit.'}
          </p>

          <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='truck-type-active'>Aktif</Label>
              <p className='text-xs text-muted-foreground'>
                Jenis nonaktif tidak muncul di form booking baru, tetapi booking
                lama tetap berjalan normal.
              </p>
            </div>
            <Switch
              id='truck-type-active'
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={save.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onDone} disabled={save.isPending}>
            Batal
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? 'Tambah' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Daftar gudang — sumber pilihan "Warehouse" di dialog dock.
 *
 * Ini sekadar metadata: kuota, booking, dan laporan tidak membedakan gudang,
 * jadi menambah gudang tidak mengubah mesin kuota sama sekali. Nama gudang
 * pertama juga dipakai di Pengaturan (tercetak di tiket supir) dan keduanya
 * ditulis bersamaan oleh server, sehingga tidak perlu disinkronkan di sini.
 */
function WarehouseSection({
  query,
  onEdit,
  onCreate,
}: {
  query: UseQueryResult<Warehouse[]>
  onEdit: (warehouse: Warehouse) => void
  onCreate: () => void
}) {
  const [search, setSearch] = useState('')
  const list = query.data

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (list ?? []).filter((warehouse) =>
      warehouse.name.toLowerCase().includes(term)
    )
  }, [list, search])

  const warehouseColumns: ColumnDef<Warehouse>[] = [
    {
      accessorKey: 'name',
      meta: { label: 'Nama', cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Nama' />
      ),
    },
    {
      id: 'docks',
      accessorFn: (warehouse) => warehouse._count?.docks ?? 0,
      enableGlobalFilter: false,
      meta: { label: 'Dock', cellClassName: 'text-sm tabular-nums' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Dock' />
      ),
      cell: ({ row }) => row.original._count?.docks ?? 0,
    },
    {
      id: 'status',
      accessorFn: (warehouse) => warehouse.isActive,
      enableGlobalFilter: false,
      meta: { label: 'Status' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Status' />
      ),
      cell: ({ row }) => (
        <Badge
          variant='outline'
          className={
            row.original.isActive
              ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
              : 'border-border text-muted-foreground'
          }
        >
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: 'Aksi',
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>Aksi</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          Ubah
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Gudang</CardTitle>
        <CardDescription>
          Setiap dock berada di satu gudang. Daftar ini hanya menjadi sumber
          pilihan di tab Dock — kuota dan laporan tetap dihitung untuk satu
          gudang.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder='Cari gudang'
          actionLabel='Tambah gudang'
          onAction={onCreate}
        />

        {query.isPending ? (
          <LoadingBlock label='Memuat gudang...' />
        ) : query.isError ? (
          <ErrorBlock
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            columns={warehouseColumns}
            data={filtered}
            getRowId={(warehouse) => String(warehouse.id)}
            emptyMessage={
              (list?.length ?? 0) === 0
                ? 'Belum ada gudang. Tambahkan satu supaya setiap dock punya tujuan.'
                : 'Tidak ada gudang yang cocok dengan pencarian.'
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

function WarehouseDialog({
  warehouse,
  onDone,
  onChanged,
}: {
  warehouse: Warehouse | null
  onDone: () => void
  onChanged: () => void
}) {
  const creating = warehouse === null
  const [name, setName] = useState(warehouse?.name ?? '')
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true)

  const dockCount = warehouse?._count?.docks ?? 0
  const valid = name.trim().length >= 2
  const dirty =
    creating ||
    name.trim() !== warehouse.name ||
    isActive !== warehouse.isActive

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), isActive }
      return creating
        ? createWarehouse({ name: payload.name })
        : updateWarehouse(warehouse.id, payload)
    },
    onSuccess: () => {
      toast.success(creating ? 'Gudang ditambahkan' : 'Gudang diperbarui')
      onChanged()
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDone()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {creating ? 'Tambah gudang' : 'Ubah gudang'}
          </DialogTitle>
          <DialogDescription>
            Nama gudang pertama juga tercetak di tiket supir, jadi mengubahnya
            di sini ikut mengubah nama di Pengaturan.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='warehouse-name'>Nama gudang</Label>
            <Input
              id='warehouse-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={save.isPending}
              autoFocus
            />
          </div>

          {!creating && (
            <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
              <div className='space-y-0.5'>
                <Label htmlFor='warehouse-active'>Aktif</Label>
                <p className='text-xs text-muted-foreground'>
                  {dockCount > 0
                    ? `Masih ada ${dockCount} dock di gudang ini, jadi belum bisa dimatikan.`
                    : 'Gudang nonaktif tidak muncul di pilihan dock.'}
                </p>
              </div>
              <Switch
                id='warehouse-active'
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={save.isPending || dockCount > 0}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onDone} disabled={save.isPending}>
            Batal
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? 'Tambah' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Dialog ubah/tambah dock. `key` di pemanggilnya membuat state form disegarkan
 * tiap baris dibuka, jadi tidak ada nilai yang nyangkut dari dock sebelumnya.
 */
function DockDialog({
  dock,
  warehouses,
  onDone,
  onChanged,
}: {
  dock: Dock | null
  warehouses: Warehouse[]
  onDone: () => void
  onChanged: () => void
}) {
  const creating = dock === null
  const [dockCode, setDockCode] = useState(dock?.dockCode ?? '')
  const [allowedActivity, setAllowedActivity] = useState<
    Dock['allowedActivity']
  >(dock?.allowedActivity ?? 'BOTH')
  const [areaName, setAreaName] = useState(dock?.areaName ?? '')
  const [warehouseId, setWarehouseId] = useState(
    String(
      dock?.warehouse?.id ??
        warehouses.find((warehouse) => warehouse.isActive)?.id ??
        ''
    )
  )

  const trimmedArea = areaName.trim()
  const valid = dockCode.trim().length >= 1 && warehouseId !== ''
  const dirty =
    creating ||
    dockCode.trim() !== dock.dockCode ||
    allowedActivity !== dock.allowedActivity ||
    (trimmedArea || null) !== (dock.areaName || null) ||
    Number(warehouseId) !== dock.warehouse?.id

  // Gudang nonaktif tidak boleh hilang dari pilihan kalau dock masih menunjuk
  // ke sana, andainya tidak ada yang memindahkannya dulu.
  const choices = warehouses.filter(
    (warehouse) => warehouse.isActive || warehouse.id === Number(warehouseId)
  )

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        dockCode: dockCode.trim(),
        allowedActivity,
        areaName: trimmedArea || null,
        warehouseId: Number(warehouseId),
      }
      return creating ? createDock(payload) : updateDock(dock.id, payload)
    },
    onSuccess: () => {
      toast.success(creating ? 'Dock ditambahkan' : 'Dock diperbarui')
      onChanged()
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDone()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {creating ? 'Tambah dock' : `Ubah dock ${dock.dockCode}`}
          </DialogTitle>
          <DialogDescription>
            Nama Area dan Warehouse hanya untuk pengelompokan — tidak
            mempengaruhi kapasitas per slot.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='dock-code'>Kode dock</Label>
            <Input
              id='dock-code'
              value={dockCode}
              onChange={(event) => setDockCode(event.target.value)}
              disabled={save.isPending}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='dock-area'>Nama Area</Label>
            <Input
              id='dock-area'
              placeholder='mis. Area B — kosongkan untuk menghapus'
              value={areaName}
              onChange={(event) => setAreaName(event.target.value)}
              maxLength={80}
              disabled={save.isPending}
            />
            <p className='text-xs text-muted-foreground'>
              Teks bebas, maksimal 80 karakter. Boleh dikosongkan bila pemetaan
              area belum ada.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='dock-warehouse'>Warehouse</Label>
            <Select
              value={warehouseId}
              disabled={save.isPending || choices.length === 0}
              onValueChange={setWarehouseId}
            >
              <SelectTrigger id='dock-warehouse'>
                <SelectValue placeholder='Pilih gudang' />
              </SelectTrigger>
              <SelectContent>
                {choices.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                    {!warehouse.isActive && ' (nonaktif)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {choices.length === 0 && (
              <p className='text-xs text-amber-700 dark:text-amber-400'>
                Belum ada gudang aktif. Tambahkan satu di tab Gudang terlebih
                dahulu.
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='dock-activity'>Melayani</Label>
            <Select
              value={allowedActivity}
              disabled={save.isPending}
              onValueChange={(value) =>
                setAllowedActivity(value as Dock['allowedActivity'])
              }
            >
              <SelectTrigger id='dock-activity'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='LOADING'>Loading</SelectItem>
                <SelectItem value='UNLOADING'>Unloading</SelectItem>
                <SelectItem value='BOTH'>Loading & Unloading</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Mengubah aktivitas mengubah kapasitas per slot; booking yang sudah
              ada tetap berjalan seperti semula.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onDone} disabled={save.isPending}>
            Batal
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? 'Tambah' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
