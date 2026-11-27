import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ClipboardList,
  Factory,
  PackageCheck,
  Truck,
  Users as UsersIcon,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import {
  fetchCustomers,
  fetchDocks,
  fetchProcessTypes,
  fetchSettings,
  fetchTruckTypes,
  fetchUsers,
  fetchWarehouses,
  updateDock,
} from '@/lib/api/endpoints'
import type {
  Customer,
  Dock,
  ManagedUser,
  ProcessType,
  TruckType,
  Warehouse,
} from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { CreateUserDialog } from '@/features/users/create-user-dialog'
import { EditUserDialog } from '@/features/users/edit-user-dialog'
import { CustomerDialog, CustomerSection } from './customer-section'
import { DockDialog, DockSection } from './dock-section'
import { ProcessTypeDialog, ProcessTypeSection } from './process-type-section'
import { SummaryCard } from './shared'
import { MASTER_TABS, type MasterTab } from './tabs'
import { TruckTypeDialog, TruckTypeSection } from './truck-type-section'
import { UsersSection } from './users-section'
import { WarehouseDialog, WarehouseSection } from './warehouse-section'

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
  const processTypes = useQuery({
    queryKey: ['master', 'process-types'],
    queryFn: fetchProcessTypes,
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
  const [editingProcessType, setEditingProcessType] =
    useState<ProcessType | null>(null)
  const [creatingProcessType, setCreatingProcessType] = useState(false)
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

  // Jenis proses dikirim lewat settings (customer tanpa sesi master), jadi
  // keduanya harus disegarkan bersama — kalau tidak, form booking memakai
  // daftar lama.
  const refreshProcessTypes = () => {
    refreshTruckTypes()
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
      processTypesTotal: processTypes.data?.length ?? 0,
      warehouseCount: warehouses.data?.length ?? 0,
      customersActive:
        customers.data?.filter((customer) => customer.isActive).length ?? 0,
      customersTotal: customers.data?.length ?? 0,
    }
  }, [
    docks.data,
    truckTypes.data,
    processTypes.data,
    warehouses.data,
    customers.data,
  ])

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
          <TabsTrigger value='process-types'>
            <PackageCheck />
            {t('master.tabProcessTypes')}
            <Badge variant='secondary' className='ml-1 h-5 px-1.5 tabular-nums'>
              {summary.processTypesTotal}
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

        <TabsContent value='process-types'>
          <ProcessTypeSection
            query={processTypes}
            onEdit={setEditingProcessType}
            onCreate={() => setCreatingProcessType(true)}
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

      {(editingProcessType || creatingProcessType) && (
        <ProcessTypeDialog
          key={editingProcessType?.id ?? 'new'}
          type={editingProcessType}
          onDone={() => {
            setEditingProcessType(null)
            setCreatingProcessType(false)
          }}
          onChanged={refreshProcessTypes}
        />
      )}
    </Main>
  )
}
