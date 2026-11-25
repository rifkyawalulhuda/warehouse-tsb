import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, PencilLine, Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createCustomer,
  createCustomerAccount,
  deleteCustomer,
  fetchCustomer,
  fetchCustomers,
  fetchWarehouses,
  updateCustomer,
  updateCustomerAccount,
} from '@/lib/api/endpoints'
import type { Customer, CustomerAccount } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { useT } from '@/lib/i18n'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'

/**
 * Master Data Customer: perusahaan beserta akun login-nya.
 *
 * Booking dimiliki perusahaan (`customers`), bukan akun. Karena itu satu
 * perusahaan bisa punya banyak akun yang semuanya melihat jadwal yang sama.
 */
export function CustomerSection({
  onEdit,
  onCreate,
}: {
  onEdit: (customer: Customer) => void
  onCreate: () => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')

  const customers = useQuery({
    queryKey: ['master', 'customers'],
    queryFn: () => fetchCustomers(),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = customers.data ?? []
    if (!term) return list
    return list.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.code.toLowerCase().includes(term) ||
        (customer.picName ?? '').toLowerCase().includes(term) ||
        (customer.phone ?? '').includes(term)
    )
  }, [customers.data, search])

  const customerColumns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'code',
      meta: { label: t('master.field.code'), cellClassName: 'font-mono text-xs' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.code')} />
      ),
    },
    {
      id: 'name',
      accessorFn: (customer) => customer.name,
      meta: { label: t('master.field.company'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.company')} />
      ),
      cell: ({ row }) => (
        <>
          {row.original.name}
          {row.original.autoApproveBooking && (
            <Badge variant='outline' className='ms-2 text-[10px]'>
              {t('master.autoBooking')}
            </Badge>
          )}
        </>
      ),
    },
    {
      id: 'pic',
      accessorFn: (customer) => customer.picName ?? '',
      meta: { label: t('master.field.pic'), cellClassName: 'text-sm' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.pic')} />
      ),
      cell: ({ row }) => (
        <>
          {row.original.picName ?? '-'}
          {row.original.phone && (
            <span className='block text-xs text-muted-foreground'>
              {row.original.phone}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'accounts',
      accessorFn: (customer) => customer._count?.users ?? 0,
      enableGlobalFilter: false,
      meta: {
        label: t('master.field.accounts'),
        headerClassName: 'text-center',
        cellClassName: 'text-center text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.accounts')} />
      ),
      cell: ({ row }) => row.original._count?.users ?? 0,
    },
    {
      id: 'bookings',
      accessorFn: (customer) => customer._count?.bookings ?? 0,
      enableGlobalFilter: false,
      meta: {
        label: t('master.customers.bookings'),
        headerClassName: 'text-center',
        cellClassName: 'text-center text-sm tabular-nums',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.customers.bookings')} />
      ),
      cell: ({ row }) => row.original._count?.bookings ?? 0,
    },
    {
      id: 'status',
      accessorFn: (customer) => customer.isActive,
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
          {t('master.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>{t('master.tabCustomers')}</CardTitle>
        <CardDescription>
          {t('master.customers.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap gap-2'>
          <div className='relative max-w-xs flex-1'>
            <Search className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('master.customers.search')}
              className='ps-8'
            />
          </div>
          <Button size='sm' onClick={onCreate}>
            <Plus /> {t('master.customers.add')}
          </Button>
        </div>

        {customers.isPending ? (
          <LoadingBlock label={t('master.customers.loading')} />
        ) : customers.isError ? (
          <ErrorBlock
            error={customers.error}
            onRetry={() => void customers.refetch()}
          />
        ) : (
          <DataTable
            columns={customerColumns}
            data={filtered}
            getRowId={(customer) => String(customer.id)}
            emptyMessage={
              (customers.data?.length ?? 0) === 0
                ? t('master.customers.empty')
                : t('master.customers.emptySearch')
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog profil + akun                                                */
/* ------------------------------------------------------------------ */

type ProfileForm = {
  name: string
  address: string
  city: string
  picName: string
  phone: string
  email: string
  taxId: string
  note: string
  isActive: boolean
  autoApproveBooking: boolean
  /** Gudang area; kosong = semua gudang (bawaan untuk customer lama). */
  warehouseIds: number[]
}

function emptyProfile(): ProfileForm {
  return {
    name: '',
    address: '',
    city: '',
    picName: '',
    phone: '',
    email: '',
    taxId: '',
    note: '',
    isActive: true,
    autoApproveBooking: false,
    warehouseIds: [],
  }
}

export function CustomerDialog({
  customer,
  onDone,
}: {
  /** null = membuat customer baru. */
  customer: Customer | null
  onDone: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const creating = customer === null

  const detail = useQuery({
    queryKey: ['master', 'customer', customer?.id],
    queryFn: () => fetchCustomer(customer!.id),
    enabled: !creating,
  })

  // Daftar gudang untuk memilih area customer. Jarang berubah, jadi cache-nya
  // dipakai bersama dialog lain lewat kunci yang sama.
  const warehouses = useQuery({
    queryKey: ['master', 'warehouses'],
    queryFn: fetchWarehouses,
    staleTime: 5 * 60_000,
  })

  const [form, setForm] = useState<ProfileForm>(() =>
    customer
      ? {
          name: customer.name,
          address: customer.address ?? '',
          city: customer.city ?? '',
          picName: customer.picName ?? '',
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          taxId: customer.taxId ?? '',
          note: customer.note ?? '',
          isActive: customer.isActive,
          autoApproveBooking: customer.autoApproveBooking,
          warehouseIds: (customer.warehouses ?? []).map((w) => w.id),
        }
      : emptyProfile()
  )
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [deleteOpen, setDeleteOpen] = useState(false)
  // `undefined` = dialog akun tertutup; objek = akun yang sedang diubah.
  const [editingAccount, setEditingAccount] = useState<
    CustomerAccount | undefined
  >(undefined)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['master', 'customers'] })
    void queryClient.invalidateQueries({
      queryKey: ['master', 'customer', customer?.id],
    })
  }

  const saveProfile = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        picName: form.picName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        taxId: form.taxId.trim() || null,
        note: form.note.trim() || null,
      }
      return creating
        ? createCustomer({
            ...payload,
            isActive: form.isActive,
            autoApproveBooking: form.autoApproveBooking,
            warehouseIds: form.warehouseIds,
          })
        : updateCustomer(customer!.id, {
            ...payload,
            isActive: form.isActive,
            autoApproveBooking: form.autoApproveBooking,
            warehouseIds: form.warehouseIds,
          })
    },
    onSuccess: () => {
      toast.success(creating ? t('master.customers.created') : t('master.customers.updated'))
      refresh()
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const addAccount = useMutation({
    mutationFn: () =>
      createCustomerAccount(customer!.id, {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        password: accountForm.password,
      }),
    onSuccess: () => {
      toast.success(t('master.customers.accountCreated'))
      setAccountForm({ name: '', email: '', password: '' })
      refresh()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const toggleAccount = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateCustomerAccount(customer!.id, userId, { isActive }),
    onSuccess: () => {
      toast.success(t('master.customers.accountUpdated'))
      refresh()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const removeCustomer = useMutation({
    mutationFn: () => deleteCustomer(customer!.id),
    onSuccess: () => {
      toast.success(t('master.customers.deleted'))
      setDeleteOpen(false)
      refresh()
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const valid = form.name.trim().length >= 2
  const accountValid =
    accountForm.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(accountForm.email.trim()) &&
    accountForm.password.length >= 7

  const accountColumns: ColumnDef<CustomerAccount>[] = [
    {
      accessorKey: 'name',
      meta: { label: t('master.field.name'), cellClassName: 'text-sm font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.name')} />
      ),
    },
    {
      accessorKey: 'email',
      meta: { label: t('master.field.email'), cellClassName: 'text-sm text-muted-foreground' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.email')} />
      ),
      cell: ({ row }) => (
        <>
          {row.original.email}
          <span className='block text-xs'>
            Dibuat {formatDate(row.original.createdAt)}
          </span>
        </>
      ),
    },
    {
      id: 'active',
      accessorFn: (account) => account.isActive,
      enableGlobalFilter: false,
      meta: {
        label: t('master.field.active'),
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('master.field.active')} />
      ),
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          disabled={toggleAccount.isPending}
          onCheckedChange={(checked) =>
            toggleAccount.mutate({
              userId: row.original.id,
              isActive: checked,
            })
          }
        />
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
          onClick={() => setEditingAccount(row.original)}
        >
          <PencilLine />
          {t('master.edit')}
        </Button>
      ),
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {creating ? t('master.addCustomer') : form.name || t('master.tabCustomers')}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? t('master.customers.newDescription')
              : t('master.customers.codeAndCount', {
                  code: customer.code,
                  count: detail.data?._count.bookings ?? 0,
                })}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='cust-name'>{t('master.customers.nameLabel')}</Label>
            <Input
              id='cust-name'
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              placeholder={t('master.customers.namePlaceholder')}
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-pic'>{t('master.customers.picLabel')}</Label>
              <Input
                id='cust-pic'
                value={form.picName}
                onChange={(event) =>
                  setForm({ ...form, picName: event.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-phone'>{t('master.customers.phoneLabel')}</Label>
              <Input
                id='cust-phone'
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-email'>{t('master.customers.emailLabel')}</Label>
              <Input
                id='cust-email'
                type='email'
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder={t('master.customers.emailPlaceholder')}
              />
              <p className='text-xs text-muted-foreground'>
                {t('master.customers.emailHint')}
              </p>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-tax'>{t('master.customers.taxIdLabel')}</Label>
              <Input
                id='cust-tax'
                value={form.taxId}
                onChange={(event) =>
                  setForm({ ...form, taxId: event.target.value })
                }
              />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-city'>{t('master.customers.cityLabel')}</Label>
              <Input
                id='cust-city'
                value={form.city}
                onChange={(event) =>
                  setForm({ ...form, city: event.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-address'>{t('master.customers.addressLabel')}</Label>
              <Input
                id='cust-address'
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </div>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cust-note'>{t('master.customers.noteLabel')}</Label>
            <Textarea
              id='cust-note'
              rows={2}
              value={form.note}
              onChange={(event) =>
                setForm({ ...form, note: event.target.value })
              }
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>{t('master.field.active')}</p>
                <p className='text-xs text-muted-foreground'>
                  {t('master.customers.accountInactiveHint')}
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isActive: checked })
                }
              />
            </div>
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>{t('master.autoBooking')}</p>
                <p className='text-xs text-muted-foreground'>
                  {t('master.customers.manualModeHint')}
                </p>
              </div>
              <Switch
                checked={form.autoApproveBooking}
                onCheckedChange={(checked) =>
                  setForm({ ...form, autoApproveBooking: checked })
                }
              />
            </div>
          </div>

          {/* Batas area dock. Kosong = bebas semua gudang, supaya customer
              lama tidak tiba-tiba kehilangan akses saat fitur ini dipasang. */}
          <fieldset className='space-y-2 rounded-md border p-3'>
            <legend className='px-1 text-sm font-medium'>
              {t('master.customers.warehouseArea')}
            </legend>
            <p className='text-xs text-muted-foreground'>
              {t('master.customers.warehouseAreaHint')}
            </p>
            {warehouses.isPending ? (
              <p className='text-sm text-muted-foreground'>
                {t('master.customers.warehouseLoading')}
              </p>
            ) : warehouses.isError ? (
              <div className='flex items-center justify-between gap-2'>
                <p className='text-sm text-destructive'>
                  {t('master.customers.warehouseLoadFailed')}
                </p>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => void warehouses.refetch()}
                >
                  {t('common.retry')}
                </Button>
              </div>
            ) : warehouses.data.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                {t('master.customers.warehouseEmpty')}
              </p>
            ) : (
              <div className='flex flex-wrap gap-x-5 gap-y-2'>
                {warehouses.data.map((warehouse) => {
                  const checked = form.warehouseIds.includes(warehouse.id)
                  return (
                    <Label
                      key={warehouse.id}
                      htmlFor={`cust-wh-${warehouse.id}`}
                      className='flex cursor-pointer items-center gap-2 text-sm font-normal'
                    >
                      <Checkbox
                        id={`cust-wh-${warehouse.id}`}
                        checked={checked}
                        onCheckedChange={(next) =>
                          setForm({
                            ...form,
                            warehouseIds:
                              next === true
                                ? [...form.warehouseIds, warehouse.id]
                                : form.warehouseIds.filter(
                                    (id) => id !== warehouse.id
                                  ),
                          })
                        }
                      />
                      {warehouse.name}
                    </Label>
                  )
                })}
              </div>
            )}
            <p className='text-xs text-muted-foreground'>
              {form.warehouseIds.length === 0
                ? t('master.customers.warehouseAll')
                : t('master.customers.warehouseSelected', {
                    count: form.warehouseIds.length,
                  })}
            </p>
          </fieldset>
        </div>

        {!creating && (
          <div className='space-y-3 border-t pt-4'>
            <div className='flex items-center gap-2'>
              <Users className='size-4 text-muted-foreground' />
              <p className='text-sm font-medium'>{t('master.customers.loginAccounts')}</p>
            </div>

            {detail.isPending ? (
              <LoadingBlock label={t('master.users.loadingAccounts')} />
            ) : detail.isError ? (
              <ErrorBlock
                error={detail.error}
                onRetry={() => void detail.refetch()}
              />
            ) : (detail.data?.users.length ?? 0) === 0 ? (
              <p className='text-sm text-muted-foreground'>
                {t('master.customers.accountsEmpty')}
              </p>
            ) : (
              <DataTable
                columns={accountColumns}
                data={detail.data!.users}
                getRowId={(account) => account.id}
                pageSize={5}
              />
            )}

            <div className='grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]'>
              <Input
                placeholder={t('master.customers.staffName')}
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, name: event.target.value })
                }
              />
              <Input
                type='email'
                placeholder={t('master.customers.emailLoginPlaceholder')}
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, email: event.target.value })
                }
              />
              <Input
                type='password'
                placeholder={t('master.customers.initialPassword')}
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm({
                    ...accountForm,
                    password: event.target.value,
                  })
                }
              />
              <Button
                size='sm'
                disabled={!accountValid || addAccount.isPending}
                onClick={() => addAccount.mutate()}
              >
                {addAccount.isPending ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <Plus />
                )}
                {t('master.add')}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className='gap-2 sm:justify-between'>
          {!creating ? (
            <Button
              variant='ghost'
              className='text-destructive hover:text-destructive'
              onClick={() => setDeleteOpen(true)}
            >
              {t('master.deleteCustomer')}
            </Button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <Button variant='outline' onClick={onDone}>
              {t('master.cancel')}
            </Button>
            <Button
              disabled={!valid || saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
            >
              {saveProfile.isPending && <Loader2 className='animate-spin' />}
              {t('master.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {editingAccount && customer && (
        <EditCustomerAccountDialog
          key={editingAccount.id}
          customerId={customer.id}
          account={editingAccount}
          onOpenChange={(open) => {
            if (!open) setEditingAccount(undefined)
          }}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('master.customers.deleteTitle')}
        desc={t('master.customers.deleteBlockedHint', {
          name: customer?.name ?? '',
        })}
        confirmText={t('master.customers.deleteConfirm')}
        destructive
        isLoading={removeCustomer.isPending}
        handleConfirm={() => removeCustomer.mutate()}
      />
    </Dialog>
  )
}

/**
 * Edit satu akun login customer: nama, email, No. HP, status aktif, dan
 * password (kosong = tidak diubah).
 *
 * Bukan `EditUserDialog` milik halaman Pengguna: akun customer diubah lewat
 * rute `/customers/:id/users/:userId` supaya perubahan selalu terikat ke
 * perusahaannya, dan peran tidak pernah ditawarkan — peran customer tetap.
 */
function EditCustomerAccountDialog({
  customerId,
  account,
  onOpenChange,
  onSaved,
}: {
  customerId: string
  account: CustomerAccount
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const t = useT()
  const [form, setForm] = useState({
    name: account.name,
    email: account.email,
    phone: account.phone ?? '',
    isActive: account.isActive,
    password: '',
  })

  const save = useMutation({
    mutationFn: () =>
      updateCustomerAccount(customerId, account.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        isActive: form.isActive,
        // Password kosong berarti "jangan diubah", bukan "kosongkan".
        ...(form.password ? { password: form.password } : {}),
      }),
    onSuccess: () => {
      toast.success(t('master.customers.accountSaved'))
      onSaved()
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const valid =
    form.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
    (form.password === '' || form.password.length >= 7)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('master.editAccountTitle')}</DialogTitle>
          <DialogDescription>
            {t('master.editAccountDesc', { email: account.email })}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='acc-name'>{t('master.nameLabel')}</Label>
            <Input
              id='acc-name'
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='acc-email'>{t('master.loginEmailLabel')}</Label>
            <Input
              id='acc-email'
              type='email'
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
            <p className='text-xs text-muted-foreground'>
              {t('master.loginEmailHint')}
            </p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='acc-phone'>{t('master.phoneLabel')}</Label>
            <Input
              id='acc-phone'
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='acc-password'>{t('master.newPasswordLabel')}</Label>
            <Input
              id='acc-password'
              type='password'
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder={t('master.customers.passwordHint')}
            />
            {form.password !== '' && form.password.length < 7 && (
              <p className='text-xs text-destructive'>
                {t('master.passwordMinHint')}
              </p>
            )}
          </div>
          <div className='flex items-center justify-between rounded-md border p-3'>
            <div>
              <p className='text-sm font-medium'>{t('master.field.active')}</p>
              <p className='text-xs text-muted-foreground'>
                {t('master.accountInactiveHint')}
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm({ ...form, isActive: checked })
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('master.cancel')}
          </Button>
          <Button
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            {t('master.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * `CustomerSection` dan `CustomerDialog` adalah pasangan yang sengaja berdekatan
 * karena keduanya berbagi bentuk form. Jumlah customer untuk kartu ringkasan
 * dihitung di `MasterData` dari query yang sama.
 */
