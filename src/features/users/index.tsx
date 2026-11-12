import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Factory, PencilLine, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import { fetchUsers, updateUser } from '@/lib/api/endpoints'
import type { ManagedUser, Role } from '@/lib/api/types'
import { formatDate, roleLabels } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { CreateUserDialog } from './create-user-dialog'
import { EditUserDialog } from './edit-user-dialog'

/**
 * Halaman ini mengelola akun STAF (Admin, Security, Checker) â€” versi penuh dari
 * tab Pengguna di Master Data.
 *
 * Akun Customer sengaja tidak ada di sini: akun customer selalu menempel ke
 * satu perusahaan, dan perusahaan dikelola di Master Data Customer. Server
 * menolak perubahan data akun customer dari rute ini; hanya kolom Aktif yang
 * tetap bisa diubah dari tombol di tabel.
 */
const ROLES: Role[] = ['ADMIN', 'GATE_OFFICER', 'CHECKER']

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | 'ALL'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  // `undefined` = dialog tertutup; objek = akun yang sedang diubah.
  const [editing, setEditing] = useState<ManagedUser | undefined>(undefined)

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

  const toggleApprove = useMutation({
    mutationFn: ({
      id,
      canApproveBooking,
    }: {
      id: string
      canApproveBooking: boolean
    }) => updateUser(id, { canApproveBooking }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const activeAdminCount = (users.data ?? []).filter(
    (user) => user.role === 'ADMIN' && user.isActive
  ).length

  const columns: ColumnDef<ManagedUser>[] = [
    {
      accessorKey: 'name',
      meta: { label: 'Nama', cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Nama' />
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
      meta: { label: 'Email', cellClassName: 'text-sm text-muted-foreground' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Email' />
      ),
    },
    {
      accessorKey: 'phone',
      meta: { label: 'No. HP', cellClassName: 'text-sm text-muted-foreground' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='No. HP' />
      ),
      cell: ({ row }) =>
        row.original.phone || (
          <span className='text-muted-foreground'>Belum diisi</span>
        ),
    },
    {
      id: 'role',
      accessorFn: (user) => roleLabels[user.role],
      meta: { label: 'Peran' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Peran' />
      ),
      cell: ({ row }) => (
        <Badge variant='outline'>{roleLabels[row.original.role]}</Badge>
      ),
    },
    {
      id: 'approve',
      accessorFn: (user) => user.canApproveBooking,
      enableGlobalFilter: false,
      meta: {
        label: 'Boleh menyetujui',
        headerClassName: 'text-center',
        cellClassName: 'text-center',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Boleh menyetujui' />
      ),
      cell: ({ row }) =>
        row.original.role === 'ADMIN' ? (
          // Admin selalu berhak; switch dimatikan agar tidak terlihat seolah
          // masih bisa dicabut.
          <span className='text-xs text-muted-foreground'>Otomatis</span>
        ) : (
          <Switch
            checked={row.original.canApproveBooking}
            disabled={toggleApprove.isPending}
            title='Izinkan pengguna ini menyetujui booking'
            onCheckedChange={(checked) =>
              toggleApprove.mutate({
                id: row.original.id,
                canApproveBooking: checked,
              })
            }
          />
        ),
    },
    {
      accessorKey: 'createdAt',
      meta: {
        label: 'Dibuat',
        cellClassName: 'text-sm text-muted-foreground',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Dibuat' />
      ),
      cell: ({ row }) => formatDate(row.original.createdAt),
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
          title={
            row.original.role === 'CUSTOMER'
              ? 'Akun customer diubah dari Master Data Customer'
              : 'Ubah data pengguna'
          }
          // Nama, email, HP, peran, dan password akun customer dikelola di tab
          // Customer. Satu-satunya "Ubah" yang bermakna di sini adalah status
          // Aktif, dan itu sudah berupa tombol tersendiri di kolom Aktif.
          disabled={row.original.role === 'CUSTOMER'}
          onClick={() => setEditing(row.original)}
        >
          <PencilLine />
          Ubah
        </Button>
      ),
    },
    {
      id: 'active',
      accessorFn: (user) => user.isActive,
      enableGlobalFilter: false,
      meta: {
        label: 'Aktif',
        headerClassName: 'text-end',
        cellClassName: 'text-end',
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Aktif' />
      ),
      cell: ({ row }) => (
        <Switch
          checked={row.original.isActive}
          disabled={
            toggleActive.isPending || row.original.id === currentUser?.id
          }
          title={
            row.original.id === currentUser?.id
              ? 'Akun Anda sendiri tidak bisa dinonaktifkan'
              : undefined
          }
          onCheckedChange={(checked) =>
            toggleActive.mutate({ id: row.original.id, isActive: checked })
          }
        />
      ),
    },
  ]

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Manajemen Pengguna'
        description='Akun Admin, Security, dan Checker. Akun Customer dikelola di Master Data Customer.'
        actions={
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              variant='outline'
              onClick={() =>
                navigate({ to: '/master', search: { tab: 'customers' } })
              }
            >
              <Factory /> Master Data Customer
            </Button>
            <Button size='sm' onClick={() => setCreateOpen(true)}>
              <Plus /> Tambah pengguna
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Daftar akun staf</CardTitle>
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
                placeholder='Cari nama atau email'
                className='ps-8'
              />
            </div>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as Role | 'ALL')}
            >
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
            <ErrorBlock
              error={users.error}
              onRetry={() => void users.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              data={users.data}
              getRowId={(user) => user.id}
              emptyMessage='Tidak ada akun staf. Tambah pengguna untuk memulai.'
            />
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false)
        }}
      />

      {editing && (
        <EditUserDialog
          key={editing.id}
          user={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined)
          }}
          isSelf={editing.id === currentUser?.id}
          isLastActiveAdmin={
            editing.role === 'ADMIN' &&
            editing.isActive &&
            activeAdminCount <= 1
          }
        />
      )}
    </Main>
  )
}
