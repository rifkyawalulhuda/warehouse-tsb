import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, PencilLine, Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createCustomer,
  createCustomerAccount,
  deleteCustomer,
  fetchCustomer,
  fetchCustomers,
  updateCustomer,
  updateCustomerAccount,
} from '@/lib/api/endpoints'
import type { Customer } from '@/lib/api/types'
import { formatDate } from '@/lib/format'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Customer</CardTitle>
        <CardDescription>
          Perusahaan pemilik booking. Akun login customer dibuat di sini, bukan di halaman
          Pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap gap-2'>
          <div className='relative max-w-xs flex-1'>
            <Search className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Cari nama, kode, PIC, atau telepon'
              className='ps-8'
            />
          </div>
          <Button size='sm' onClick={onCreate}>
            <Plus /> Tambah customer
          </Button>
        </div>

        {customers.isPending ? (
          <LoadingBlock label='Memuat customer...' />
        ) : customers.isError ? (
          <ErrorBlock error={customers.error} onRetry={() => void customers.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>PIC</TableHead>
                <TableHead className='text-center'>Akun</TableHead>
                <TableHead className='text-center'>Booking</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-right'>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow key={customer.id} className={customer.isActive ? '' : 'opacity-70'}>
                  <TableCell className='font-mono text-xs'>{customer.code}</TableCell>
                  <TableCell className='font-medium'>
                    {customer.name}
                    {customer.autoApproveBooking && (
                      <Badge variant='outline' className='ms-2 text-[10px]'>
                        Booking otomatis
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-sm'>
                    {customer.picName ?? '-'}
                    {customer.phone && (
                      <span className='block text-xs text-muted-foreground'>
                        {customer.phone}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className='text-center text-sm tabular-nums'>
                    {customer._count?.users ?? 0}
                  </TableCell>
                  <TableCell className='text-center text-sm tabular-nums'>
                    {customer._count?.bookings ?? 0}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={
                        customer.isActive
                          ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300'
                          : 'border-border text-muted-foreground'
                      }
                    >
                      {customer.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button size='sm' variant='outline' onClick={() => onEdit(customer)}>
                      <PencilLine />
                      Ubah
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='py-8 text-center text-sm text-muted-foreground'
                  >
                    {(customers.data?.length ?? 0) === 0
                      ? 'Belum ada customer. Tambahkan satu supaya akun bisa booking.'
                      : 'Tidak ada customer yang cocok dengan pencarian.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
  const queryClient = useQueryClient()
  const creating = customer === null

  const detail = useQuery({
    queryKey: ['master', 'customer', customer?.id],
    queryFn: () => fetchCustomer(customer!.id),
    enabled: !creating,
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
        }
      : emptyProfile()
  )
  const [accountForm, setAccountForm] = useState({ name: '', email: '', password: '' })
  const [deleteOpen, setDeleteOpen] = useState(false)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['master', 'customers'] })
    void queryClient.invalidateQueries({ queryKey: ['master', 'customer', customer?.id] })
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
        ? createCustomer({ ...payload, isActive: form.isActive, autoApproveBooking: form.autoApproveBooking })
        : updateCustomer(customer!.id, {
            ...payload,
            isActive: form.isActive,
            autoApproveBooking: form.autoApproveBooking,
          })
    },
    onSuccess: () => {
      toast.success(creating ? 'Customer dibuat' : 'Customer disimpan')
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
      toast.success('Akun customer dibuat')
      setAccountForm({ name: '', email: '', password: '' })
      refresh()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const toggleAccount = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateCustomerAccount(customer!.id, userId, { isActive }),
    onSuccess: () => {
      toast.success('Status akun diperbarui')
      refresh()
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const removeCustomer = useMutation({
    mutationFn: () => deleteCustomer(customer!.id),
    onSuccess: () => {
      toast.success('Customer dihapus')
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

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{creating ? 'Tambah customer' : form.name || 'Customer'}</DialogTitle>
          <DialogDescription>
            {creating
              ? 'Kode customer dibuat otomatis. Akun login bisa ditambahkan setelah tersimpan.'
              : `Kode ${customer.code} · ${detail.data?._count.bookings ?? 0} booking`}
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='cust-name'>Nama perusahaan</Label>
            <Input
              id='cust-name'
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder='PT Contoh Logistik'
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-pic'>Nama PIC</Label>
              <Input
                id='cust-pic'
                value={form.picName}
                onChange={(event) => setForm({ ...form, picName: event.target.value })}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-phone'>Telepon</Label>
              <Input
                id='cust-phone'
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-email'>Email perusahaan</Label>
              <Input
                id='cust-email'
                type='email'
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder='ops@perusahaan.co.id'
              />
              <p className='text-xs text-muted-foreground'>
                Bukan email login. Login memakai email akun di bawah.
              </p>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-tax'>NPWP</Label>
              <Input
                id='cust-tax'
                value={form.taxId}
                onChange={(event) => setForm({ ...form, taxId: event.target.value })}
              />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='cust-city'>Kota</Label>
              <Input
                id='cust-city'
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='cust-address'>Alamat</Label>
              <Input
                id='cust-address'
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </div>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='cust-note'>Catatan</Label>
            <Textarea
              id='cust-note'
              rows={2}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>Aktif</p>
                <p className='text-xs text-muted-foreground'>
                  Nonaktif membuat akunnya gagal booking.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>Booking otomatis</p>
                <p className='text-xs text-muted-foreground'>
                  Saat mode Manual, booking perusahaan ini tidak antre.
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
        </div>

        {!creating && (
          <div className='space-y-3 border-t pt-4'>
            <div className='flex items-center gap-2'>
              <Users className='size-4 text-muted-foreground' />
              <p className='text-sm font-medium'>Akun login</p>
            </div>

            {detail.isPending ? (
              <LoadingBlock label='Memuat akun...' />
            ) : detail.isError ? (
              <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />
            ) : (detail.data?.users.length ?? 0) === 0 ? (
              <p className='text-sm text-muted-foreground'>
                Belum ada akun. Customer tidak bisa login sebelum akun dibuat.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className='text-end'>Aktif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.data!.users.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className='text-sm font-medium'>{account.name}</TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {account.email}
                        <span className='block text-xs'>
                          Dibuat {formatDate(account.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className='text-end'>
                        <Switch
                          checked={account.isActive}
                          disabled={toggleAccount.isPending}
                          onCheckedChange={(checked) =>
                            toggleAccount.mutate({ userId: account.id, isActive: checked })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className='grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]'>
              <Input
                placeholder='Nama staf'
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, name: event.target.value })
                }
              />
              <Input
                type='email'
                placeholder='email@perusahaan.co.id'
                value={accountForm.email}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, email: event.target.value })
                }
              />
              <Input
                type='password'
                placeholder='Password awal'
                value={accountForm.password}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, password: event.target.value })
                }
              />
              <Button
                size='sm'
                disabled={!accountValid || addAccount.isPending}
                onClick={() => addAccount.mutate()}
              >
                {addAccount.isPending ? <Loader2 className='animate-spin' /> : <Plus />}
                Tambah
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
              Hapus customer
            </Button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <Button variant='outline' onClick={onDone}>
              Batal
            </Button>
            <Button disabled={!valid || saveProfile.isPending} onClick={() => saveProfile.mutate()}>
              {saveProfile.isPending && <Loader2 className='animate-spin' />}
              Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Hapus customer?'
        desc={`Customer ${customer?.name ?? ''} hanya bisa dihapus bila tidak punya akun maupun booking.`}
        confirmText='Ya, hapus'
        destructive
        isLoading={removeCustomer.isPending}
        handleConfirm={() => removeCustomer.mutate()}
      />
    </Dialog>
  )
}

/**
 * `CustomerSection` dan `CustomerDialog` adalah pasangan yang sengaja berdekatan
 * karena keduanya berbagi bentuk form. Jumlah customer untuk kartu ringkasan
 * dihitung di `MasterData` dari query yang sama.
 */
