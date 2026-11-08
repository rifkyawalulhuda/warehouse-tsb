import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { createUser, fetchUsers, updateUser } from '@/lib/api/endpoints'
import type { ManagedUser, Role } from '@/lib/api/types'
import { formatDate, roleLabels } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ROLES: Role[] = ['ADMIN', 'CUSTOMER', 'GATE_OFFICER', 'CHECKER']

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)

  const users = useQuery({
    queryKey: ['users', { q, role }],
    queryFn: () =>
      fetchUsers({
        q: q.trim() || undefined,
        role: role === 'ALL' ? undefined : role,
      }),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateUser(id, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const toggleFlag = useMutation({
    mutationFn: (params: {
      id: string
      autoApproveBooking?: boolean
      canApproveBooking?: boolean
    }) => updateUser(params.id, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Manajemen Pengguna'
        description='Akun Security, Checker, dan Customer hanya bisa dibuat dari sini. Atur juga siapa yang boleh melewati antrean persetujuan booking.'
        actions={
          <Button size='sm' onClick={() => setCreateOpen(true)}>
            <Plus /> Tambah pengguna
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Daftar akun</CardTitle>
          <CardDescription>
            {users.data ? `${users.data.length} akun terdaftar.` : 'Memuat...'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-2'>
            <div className='relative max-w-xs flex-1'>
              <Search className='absolute start-2.5 top-2.5 size-4 text-muted-foreground' />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder='Cari nama, email, perusahaan'
                className='ps-8'
              />
            </div>
            <Select value={role} onValueChange={(value) => setRole(value as Role | 'ALL')}>
              <SelectTrigger className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='ALL'>Semua peran</SelectItem>
                {ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {users.isPending ? (
            <LoadingBlock label='Memuat pengguna...' />
          ) : users.isError ? (
            <ErrorBlock error={users.error} onRetry={() => void users.refetch()} />
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead>Perusahaan</TableHead>
                    <TableHead className='text-center'>Booking otomatis</TableHead>
                    <TableHead className='text-center'>Boleh menyetujui</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className='text-end'>Aktif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className='font-medium'>
                        {user.name}
                        {user.id === currentUser?.id && (
                          <Badge variant='secondary' className='ms-2'>
                            Anda
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>{roleLabels[user.role]}</Badge>
                      </TableCell>
                      <TableCell className='text-sm'>
                        {user.companyName ?? '-'}
                      </TableCell>
                      <TableCell className='text-center'>
                        {user.role === 'CUSTOMER' ? (
                          <Switch
                            checked={user.autoApproveBooking}
                            disabled={toggleFlag.isPending}
                            title='Saat mode Manual, booking customer ini tidak perlu antre'
                            onCheckedChange={(checked) =>
                              toggleFlag.mutate({
                                id: user.id,
                                autoApproveBooking: checked,
                              })
                            }
                          />
                        ) : (
                          <span className='text-xs text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell className='text-center'>
                        {user.role === 'ADMIN' ? (
                          // Admin selalu berhak; switch-nya dimatikan agar tidak
                          // terlihat seolah masih bisa dicabut.
                          <span className='text-xs text-muted-foreground'>Otomatis</span>
                        ) : (
                          <Switch
                            checked={user.canApproveBooking}
                            disabled={toggleFlag.isPending}
                            title='Izinkan pengguna ini menyetujui booking'
                            onCheckedChange={(checked) =>
                              toggleFlag.mutate({
                                id: user.id,
                                canApproveBooking: checked,
                              })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className='text-end'>
                        <Switch
                          checked={user.isActive}
                          disabled={
                            toggleActive.isPending || user.id === currentUser?.id
                          }
                          title={
                            user.id === currentUser?.id
                              ? 'Akun Anda sendiri tidak bisa dinonaktifkan'
                              : undefined
                          }
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({ id: user.id, isActive: checked })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Main>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    role: 'CUSTOMER' as Role,
    password: '',
  })

  const reset = () =>
    setForm({
      name: '',
      email: '',
      phone: '',
      companyName: '',
      role: 'CUSTOMER',
      password: '',
    })

  const create = useMutation({
    mutationFn: () =>
      createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
        phone: form.phone.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
      }),
    onSuccess: (user: ManagedUser) => {
      toast.success(`Akun ${user.email} dibuat`)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      reset()
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const needsCompany = form.role === 'CUSTOMER'
  const valid =
    form.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
    form.password.length >= 7 &&
    (!needsCompany || form.companyName.trim().length >= 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Tambah pengguna</DialogTitle>
          <DialogDescription>
            Password awal harus diganti pengguna setelah login pertama.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='new-name'>Nama</Label>
            <Input
              id='new-name'
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='new-email'>Email</Label>
              <Input
                id='new-email'
                type='email'
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='new-phone'>No. HP</Label>
              <Input
                id='new-phone'
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label>Peran</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm({ ...form, role: value as Role })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {roleLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='new-company'>
                Perusahaan {needsCompany ? '' : '(opsional)'}
              </Label>
              <Input
                id='new-company'
                value={form.companyName}
                onChange={(event) =>
                  setForm({ ...form, companyName: event.target.value })
                }
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='new-password'>Password awal</Label>
            <Input
              id='new-password'
              type='password'
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder='Minimal 7 karakter'
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button disabled={!valid || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className='animate-spin' />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
