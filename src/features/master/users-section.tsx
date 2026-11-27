/**
 * Tab Pengguna: daftar akun staf beserta penyaring peran.
 *
 * Dipisah dari `index.tsx` supaya tiap tab Master Data punya berkasnya sendiri;
 * berkas gabungannya dulu 2171 baris dan 12 komponen.
 */
import { useMemo, useState } from 'react'
import { type UseQueryResult } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { PencilLine, Plus, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import type { ManagedUser, Role } from '@/lib/api/types'
import { roleLabels } from '@/lib/format'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { STAFF_ROLES } from '@/features/users/create-user-dialog'

export function UsersSection({
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

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (users.data ?? []).filter(
      (user) =>
        (role === 'ALL' || user.role === role) &&
        (term === '' ||
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term))
    )
  }, [users.data, search, role])
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
      meta: {
        label: t('master.field.email'),
        cellClassName: 'text-sm text-muted-foreground',
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.field.email')}
        />
      ),
    },
    {
      accessorKey: 'phone',
      meta: {
        label: t('master.field.phone'),
        cellClassName: 'text-sm text-muted-foreground',
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.field.phone')}
        />
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
        <DataTableColumnHeader
          column={column}
          title={t('master.field.canApprove')}
        />
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
        <DataTableColumnHeader
          column={column}
          title={t('master.field.status')}
        />
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
          {row.original.isActive
            ? t('master.field.active')
            : t('master.field.inactive')}
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
                <SelectItem value='ALL'>
                  {t('master.users.allRoles')}
                </SelectItem>
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
