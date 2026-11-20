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
  Users as UsersIcon,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createDock,
  createTruckType,
  createWarehouse,
  fetchCustomers,
  fetchDocks,
  fetchSettings,
  fetchTruckTypes,
  fetchUsers,
  fetchWarehouses,
  updateDock,
  updateTruckType,
  updateWarehouse,
} from '@/lib/api/endpoints'
import type {
  Customer,
  Dock,
  ManagedUser,
  Role,
  TruckType,
  Warehouse,
} from '@/lib/api/types'
import { durationLabel, roleLabels } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
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
import {
  CreateUserDialog,
  STAFF_ROLES,
} from '@/features/users/create-user-dialog'
import { EditUserDialog } from '@/features/users/edit-user-dialog'
import { CustomerDialog, CustomerSection } from './customer-section'
import { MASTER_TABS, type MasterTab } from './tabs'

/**
 * Kapasitas kuota tidak diatur manual di sini. Kuota per slot adalah jumlah dock
 * aktif yang mengizinkan aktivitas tersebut, jadi mengubah daftar dock berarti
 * mengubah kapasitas — satu sumber kebenaran, tidak ada dua angka yang bisa
 * saling bertentangan.
 */
export function MasterData({ initialTab }: { initialTab?: MasterTab }) {
  const t = useT()
  useRealtimeSync()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const isAdmin = currentUser?.role === 'ADMIN'
  // Tab awal datang dari `?tab=` di URL, supaya "Akun Customer dikelola di
  // Master Data Customer" dan tautan sidebar mendarat di tab yang benar.
  const [tab, setTab] = useState<MasterTab>(() => {
    if (initialTab === 'users' && !isAdmin) return 'docks'
    return MASTER_TABS.find((item) => item === initialTab) ?? 'docks'
  })

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
  const [editingUser, setEditingUser] = useState<ManagedUser | undefined>(
    undefined
  )
  const [creatingUser, setCreatingUser] = useState(false)
  // Dihitung dari daftar yang sama dengan tabel Pengguna (satu key, tanpa
  // filter), supaya dialog Ubah tahu kapan perubahan terakhir ini akan
  // menghabiskan Admin aktif.
  const users = useQuery({
    queryKey: ['master', 'users'],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
    // Saat kembali ke tab Pengguna, tampilkan daftar lama selama memuat ulang
    // agar tabel tidak sempat berkedip "Belum ada akun staf".
    placeholderData: (previous) => previous,
  })
  const activeAdminCount = (users.data ?? []).filter(
    (user) => user.role === 'ADMIN' && user.isActive
  ).length

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
      toast.success(t('master.docks.statusUpdated'))
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
        title={t('master.title')}
        description={t('master.docks.summaryNote')}
      />

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <SummaryCard
          icon={Building2}
          label={t('master.summary.ready')}
          value={`${summary.docksActive}`}
          unit={t('master.summary.of', { count: summary.docksTotal })}
          hint={
            summary.docksTotal - summary.docksActive > 0
              ? t('master.summary.maintenance', {
                  count: summary.docksTotal - summary.docksActive,
                })
              : t('master.summary.readyHint')
          }
          tone='sky'
        />
        <SummaryCard
          icon={WarehouseIcon}
          label={t('master.summary.loadingCap')}
          value={`${summary.loading}`}
          unit={t('master.field.perSlot')}
          hint={t('master.summary.loadingCapHint')}
          tone='indigo'
        />
        <SummaryCard
          icon={WarehouseIcon}
          label={t('master.summary.unloadingCap')}
          value={`${summary.unloading}`}
          unit={t('master.field.perSlot')}
          hint={t('master.summary.unloadingCapHint')}
          tone='violet'
        />
        <SummaryCard
          icon={Truck}
          label={t('master.summary.truckTypes')}
          value={`${summary.truckTypesActive}`}
          unit={t('master.summary.readyOf', {
            count: summary.truckTypesTotal,
          })}
          hint={
            summary.truckTypesActive === 0
              ? t('master.summary.noTruckType')
              : t('master.summary.truckTypesHint')
          }
          tone={summary.truckTypesActive === 0 ? 'amber' : 'emerald'}
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as MasterTab)}
        className='gap-4'
      >
        <TabsList>
          <TabsTrigger value='docks'>
            <ClipboardList />
            {t('master.tabDocks')}
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.docksTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='warehouses'>
            <WarehouseIcon />
            {t('master.tabWarehouses')}
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.warehouseCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='truck-types'>
            <Truck />
            {t('master.tabTrucks')}
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.truckTypesTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='customers'>
            <Factory />
            {t('master.tabCustomers')}
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.customersTotal}
            </Badge>
          </TabsTrigger>
          {/* Tab Pengguna hanya untuk Admin: akun staf mengatur dirinya sendiri,
              dan menyembunyikan tab lebih jujur daripada tab yang menolak dengan
              UNAUTHORIZED saat diklik. */}
          {isAdmin && (
            <TabsTrigger value='users'>
              <UsersIcon />
              {t('master.tabUsers')}
            </TabsTrigger>
          )}
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
        {isAdmin && (
          <TabsContent value='users'>
            <UsersSection
              onCreate={() => setCreatingUser(true)}
              onEdit={setEditingUser}
              query={users}
            />
          </TabsContent>
        )}
      </Tabs>

      {isAdmin && creatingUser && (
        <CreateUserDialog
          key='new'
          open
          onOpenChange={(open) => {
            if (!open) setCreatingUser(false)
          }}
        />
      )}

      {isAdmin && editingUser && (
        <EditUserDialog
          key={editingUser.id}
          user={editingUser}
          open
          onOpenChange={(open) => {
            if (!open) setEditingUser(undefined)
          }}
          isSelf={editingUser.id === currentUser?.id}
          isLastActiveAdmin={
            editingUser.role === 'ADMIN' &&
            editingUser.isActive &&
            activeAdminCount <= 1
          }
          withStatus
        />
      )}

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

function UsersSection({
  onCreate,
  onEdit,
  query,
}: {
  onCreate: () => void
  onEdit: (user: ManagedUser) => void
  query: UseQueryResult<ManagedUser[]>
}) {
  const t = useT()
  const currentUser = useAuthStore((state) => state.user)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | 'ALL'>('ALL')

  const users = query
  const allUsers = users.data ?? []

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allUsers.filter(
      (user) =>
        (role === 'ALL' || user.role === role) &&
        (term === '' ||
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term))
    )
  }, [allUsers, search, role])
  const activeCount = rows.filter((user) => user.isActive).length

  const userColumns: ColumnDef<ManagedUser>[] = [
    {
      accessorKey: 'name',
      meta: { label: t('master.field.name'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.name')} />
      ),
      cell: ({ row }) => (
        <>
          {row.original.name}
          {row.original.id === currentUser?.id && (
            <Badge variant='secondary' className='ms-2'>
              Anda
            </Badge>
          )}
        </>
      ),
    },
    {
      accessorKey: 'email',
      meta: { label: t('master.field.email'), cellClassName: 'text-sm text-muted-foreground' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.email')} />
      ),
    },
    {
      accessorKey: 'phone',
      meta: { label: t('master.field.phone'), cellClassName: 'text-sm text-muted-foreground' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.phone')} />
      ),
      cell: ({ row }) =>
        row.original.phone || (
          <span className='text-muted-foreground'>{t('master.notFilled')}</span>
        ),
    },
    {
      id: 'role',
      accessorFn: (user) => roleLabels[user.role],
      meta: { label: t('master.field.role') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.role')} />
      ),
      cell: ({ row }) => (
        <Badge variant='outline'>{roleLabels[row.original.role]}</Badge>
      ),
    },
    {
      id: 'approve',
      accessorFn: (user) => user.canApproveBooking,
      enableGlobalFilter: false,
      meta: { label: t('master.field.canApprove') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.canApprove')} />
      ),
      cell: ({ row }) =>
        row.original.role === 'ADMIN'
          ? t('master.users.roleAll')
          : row.original.canApproveBooking
            ? t('master.field.yes')
            : t('master.field.noValue'),
    },
    {
      id: 'active',
      accessorFn: (user) => user.isActive,
      enableGlobalFilter: false,
      meta: { label: t('master.field.status') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.status')} />
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
          {row.original.isActive ? t('master.field.active') : t('master.field.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: t('master.field.action'),
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      header: () => <span>{t('master.field.action')}</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('master.users.title')}</CardTitle>
        <CardDescription>{t('master.users.description')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center'>
            <div className='relative w-full sm:max-w-xs'>
              <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('master.users.search')}
                className='pl-8'
                aria-label={t('master.users.search')}
              />
            </div>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role | 'ALL')}
            >
              <SelectTrigger
                className='w-full sm:w-44'
                aria-label={t('master.users.filterRole')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>{t('master.users.allRoles')}</SelectItem>
                {STAFF_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex gap-2 sm:shrink-0'>
            <Button size='sm' variant='outline' onClick={onCreate}>
              <Plus />
              {t('master.users.add')}
            </Button>
          </div>
        </div>

        <p className='text-xs text-muted-foreground'>
          {users.data
            ? `${t('master.users.count', { rows: rows.length, active: activeCount })} ${t('master.users.hint')}`
            : t('master.users.loadingAccounts')}
        </p>

        {users.isPending ? (
          <LoadingBlock label={t('master.users.loadingUsers')} />
        ) : users.isError ? (
          <ErrorBlock
            error={users.error}
            onRetry={() => void users.refetch()}
          />
        ) : (
          <DataTable
            columns={userColumns}
            data={rows}
            getRowId={(user) => user.id}
            emptyMessage={t('master.users.emptyStaff')}
          />
        )}
      </CardContent>
    </Card>
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
  const t = useT()
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
      const key = dock.warehouse?.name ?? t('master.docks.withoutWarehouse')
      const bucket = map.get(key)
      if (bucket) bucket.push(dock)
      else map.set(key, [dock])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  })()

  const dockColumns: ColumnDef<Dock>[] = [
    {
      accessorKey: 'dockCode',
      meta: { label: t('master.field.code'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.code')} />
      ),
    },
    {
      id: 'areaName',
      accessorFn: (dock) => dock.areaName ?? '',
      meta: { label: t('master.field.area'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.area')} />
      ),
      cell: ({ row }) =>
        row.original.areaName || (
          <span className='text-muted-foreground'>{t('master.notFilled')}</span>
        ),
    },
    {
      id: 'warehouse',
      accessorFn: (dock) => dock.warehouse?.name ?? '',
      meta: { label: t('master.docks.warehouse'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.docks.warehouse')} />
      ),
      cell: ({ row }) => row.original.warehouse?.name ?? '—',
    },
    {
      id: 'activity',
      accessorFn: (dock) => dock.allowedActivity,
      enableGlobalFilter: false,
      meta: { label: t('master.docks.serves') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.docks.serves')} />
      ),
      cell: ({ row }) => (
        <div className='flex flex-wrap gap-1'>
          {(row.original.allowedActivity === 'BOTH'
            ? ['LOADING', 'UNLOADING']
            : [row.original.allowedActivity]
          ).map((item) => (
            <Badge key={item} variant='outline' className='font-normal'>
              {t(item === 'LOADING' ? 'activity.LOADING' : 'activity.UNLOADING')}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      accessorFn: (dock) => dock.currentStatus,
      enableGlobalFilter: false,
      meta: { label: t('master.field.status') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.status')} />
      ),
      cell: ({ row }) =>
        row.original.currentStatus === 'OCCUPIED' ? (
          <div className='flex items-center gap-2'>
            <Badge
              variant='outline'
              className='border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
            >
              {t('dashboard.dockOccupied')}
            </Badge>
            <span className='text-xs text-muted-foreground'>
              {t('master.docks.lockedByBooking')}
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
              aria-label={t('master.docks.statusAria', {
                code: row.original.dockCode,
                status:
                  row.original.currentStatus === 'AVAILABLE'
                    ? t('master.docks.available')
                    : t('master.docks.maintenance'),
              })}
            />
            <span className='text-sm'>
              {row.original.currentStatus === 'AVAILABLE'
                ? t('master.docks.statusAvailable')
                : t('master.docks.statusMaintenance')}
            </span>
          </label>
        ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: t('master.field.action'),
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>{t('master.field.action')}</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('master.docks.title')}</CardTitle>
        <CardDescription>
          {capacities
            ? t('master.docks.capacity', {
                loading: capacities.LOADING,
                unloading: capacities.UNLOADING,
              })
            : t('master.docks.capacityLoading')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder={t('master.docks.search')}
          actionLabel={t('master.addDock')}
          onAction={onCreate}
        >
          <Select
            value={activity}
            onValueChange={(value) => setActivity(value as typeof activity)}
          >
            <SelectTrigger
              className='w-full sm:w-44'
              aria-label={t('master.docks.filterActivity')}
            >
              <ArrowDownUp className='size-4 text-muted-foreground' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>{t('master.docks.allActivities')}</SelectItem>
              <SelectItem value='LOADING'>{t('activity.LOADING')}</SelectItem>
              <SelectItem value='UNLOADING'>{t('activity.UNLOADING')}</SelectItem>
              <SelectItem value='BOTH'>{t('activity.BOTH')}</SelectItem>
            </SelectContent>
          </Select>
        </SectionToolbar>

        {query.isPending ? (
          <LoadingBlock label={t('master.docks.loading')} />
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
                    ? (dock) => dock.warehouse?.name ?? t('master.docks.withoutWarehouse')
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
                    ? t('master.docks.empty')
                    : t('master.docks.noMatch')
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
                        {dock.areaName || t('master.docks.areaEmpty')} ·{' '}
                        {dock.warehouse?.name ?? '—'}
                      </p>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => onEdit(dock)}
                    >
                      <PencilLine />
                      {t('common.edit')}
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
                        {t(item === 'LOADING' ? 'activity.LOADING' : 'activity.UNLOADING')}
                      </Badge>
                    ))}
                    {dock.currentStatus === 'OCCUPIED' ? (
                      <Badge
                        variant='outline'
                        className='border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
                      >
                        {t('dashboard.dockOccupied')}
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
                          aria-label={t('master.docks.statusAriaShort', { code: dock.dockCode })}
                        />
                        <span className='text-xs'>
                          {dock.currentStatus === 'AVAILABLE'
                            ? t('master.docks.statusAvailable')
                            : t('master.docks.statusMaintenance')}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  {(docks?.length ?? 0) === 0
                    ? t('master.docks.emptyShort')
                    : t('master.docks.noMatch')}
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
  const t = useT()
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
      meta: { label: t('master.trucks.type'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.trucks.type')} />
      ),
    },
    {
      accessorKey: 'durationMinutes',
      meta: { label: t('master.trucks.duration') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.trucks.duration')} />
      ),
      cell: ({ row }) => (
        <div className='flex flex-wrap items-center gap-1.5 text-sm'>
          {durationLabel(row.original.durationMinutes)}
          <Badge variant='secondary' className='font-normal tabular-nums'>
            {t('master.trucks.blocks', { count: row.original.blocksRequired })}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'sortOrder',
      meta: {
        label: t('master.field.sortOrder'),
        cellClassName: 'text-sm tabular-nums text-muted-foreground',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.sortOrder')} />
      ),
    },
    {
      id: 'status',
      accessorFn: (type) => type.isActive,
      enableGlobalFilter: false,
      meta: { label: t('master.field.status') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.status')} />
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
          {row.original.isActive ? t('master.field.active') : t('master.field.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: t('master.field.action'),
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>{t('master.field.action')}</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('master.trucks.title')}</CardTitle>
        <CardDescription>{t('master.trucks.description')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder={t('master.trucks.search')}
          actionLabel={t('master.addTruck')}
          onAction={onCreate}
        >
          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <Switch
              checked={onlyActive}
              onCheckedChange={setOnlyActive}
              aria-label={t('master.trucks.onlyActive')}
            />
            {t('master.trucks.onlyActive')}
          </label>
        </SectionToolbar>

        {query.data && activeCount === 0 && (
          <p className='rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'>
            {t('master.trucks.noneActive')}
          </p>
        )}

        {query.isPending ? (
          <LoadingBlock label={t('master.trucks.loading')} />
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
                ? t('master.trucks.empty')
                : t('master.trucks.noMatch')
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
  const t = useT()
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
        creating ? t('master.trucks.created') : t('master.trucks.updated')
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
            {creating ? t('master.addTruck') : t('master.trucks.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? t('master.trucks.newDescription')
              : t('master.trucks.editHint')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='truck-type-name'>{t('master.trucks.nameLabel')}</Label>
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
              <Label htmlFor='truck-type-duration'>{t('master.trucks.durationLabel')}</Label>
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
              <Label htmlFor='truck-type-sort'>{t('master.trucks.sortLabel')}</Label>
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
              ? t('master.trucks.durationSummary', {
                  duration: durationLabel(minutes),
                  blocks,
                })
              : t('master.trucks.minDurationHint')}
          </p>

          <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='truck-type-active'>{t('master.field.active')}</Label>
              <p className='text-xs text-muted-foreground'>
                {t('master.trucks.inactiveHint')}
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
            {t('master.cancel')}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? t('master.action.add') : t('master.action.save')}
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
  const t = useT()
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
      meta: { label: t('master.field.name'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.name')} />
      ),
    },
    {
      id: 'docks',
      accessorFn: (warehouse) => warehouse._count?.docks ?? 0,
      enableGlobalFilter: false,
      meta: { label: t('master.field.dock'), cellClassName: 'text-sm tabular-nums' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.dock')} />
      ),
      cell: ({ row }) => row.original._count?.docks ?? 0,
    },
    {
      id: 'status',
      accessorFn: (warehouse) => warehouse.isActive,
      enableGlobalFilter: false,
      meta: { label: t('master.field.status') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.status')} />
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
          {row.original.isActive ? t('master.field.active') : t('master.field.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      enableSorting: false,
      enableHiding: false,
      meta: {
        label: t('master.field.action'),
        headerClassName: 'text-right',
        cellClassName: 'text-right',
      },
      header: () => <span>{t('master.field.action')}</span>,
      cell: ({ row }) => (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(row.original)}
        >
          <PencilLine />
          {t('common.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('master.warehouses.title')}</CardTitle>
        <CardDescription>
          {t('master.warehouses.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder={t('master.warehouses.search')}
          actionLabel={t('master.addWarehouse')}
          onAction={onCreate}
        />

        {query.isPending ? (
          <LoadingBlock label={t('master.warehouses.loading')} />
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
                ? t('master.warehouses.empty')
                : t('master.warehouses.noMatch')
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
  const t = useT()
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
      toast.success(creating ? t('master.warehouses.created') : t('master.warehouses.updated'))
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
            {creating ? t('master.addWarehouse') : t('master.warehouses.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('master.warehouses.dialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='warehouse-name'>{t('master.warehouses.nameLabel')}</Label>
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
                <Label htmlFor='warehouse-active'>{t('master.field.active')}</Label>
                <p className='text-xs text-muted-foreground'>
                  {dockCount > 0
                    ? t('master.warehouses.hasDocks', { count: dockCount })
                    : t('master.warehouses.activeHint')}
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
            {t('master.cancel')}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? t('master.action.add') : t('master.action.save')}
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
  const t = useT()
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
      toast.success(creating ? t('master.docks.created') : t('master.docks.updated'))
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
            {creating
              ? t('master.addDock')
              : t('master.docks.editTitle', { code: dock.dockCode })}
          </DialogTitle>
          <DialogDescription>
            {t('master.docks.dialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='dock-code'>{t('master.docks.codeLabel')}</Label>
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
            <Label htmlFor='dock-area'>{t('master.docks.areaLabel')}</Label>
            <Input
              id='dock-area'
              placeholder={t('master.docks.areaPlaceholderEmpty')}
              value={areaName}
              onChange={(event) => setAreaName(event.target.value)}
              maxLength={80}
              disabled={save.isPending}
            />
            <p className='text-xs text-muted-foreground'>
              {t('master.docks.areaHint')}
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
                <SelectValue placeholder={t('master.docks.pickWarehouse')} />
              </SelectTrigger>
              <SelectContent>
                {choices.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                    {!warehouse.isActive && t('master.docks.inactiveSuffix')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {choices.length === 0 && (
              <p className='text-xs text-amber-700 dark:text-amber-400'>
                {t('master.docks.noWarehouseActive')}
              </p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='dock-activity'>{t('master.docks.servesLabel')}</Label>
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
                <SelectItem value='LOADING'>{t('activity.LOADING')}</SelectItem>
                <SelectItem value='UNLOADING'>{t('activity.UNLOADING')}</SelectItem>
                <SelectItem value='BOTH'>{t('activity.BOTH')}</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              {t('master.docks.activityHint')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onDone} disabled={save.isPending}>
            {t('master.cancel')}
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid || !dirty}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {creating ? t('master.action.add') : t('master.action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
