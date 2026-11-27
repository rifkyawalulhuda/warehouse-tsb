/**
 * Tab Gudang: daftar gudang dan dialog tambah/ubah.
 *
 * Dipisah dari `index.tsx` supaya tiap tab Master Data punya berkasnya sendiri;
 * berkas gabungannya dulu 2171 baris dan 12 komponen.
 */
import { useMemo, useState } from 'react'
import { useMutation, type UseQueryResult } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Loader2, PencilLine } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { createWarehouse, updateWarehouse } from '@/lib/api/endpoints'
import type { Warehouse } from '@/lib/api/types'
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
import { Switch } from '@/components/ui/switch'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { SectionToolbar } from './shared'

export function WarehouseSection({
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
      meta: {
        label: t('master.field.dock'),
        cellClassName: 'text-sm tabular-nums',
      },
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
        <CardTitle className='text-base'>
          {t('master.warehouses.title')}
        </CardTitle>
        <CardDescription>{t('master.warehouses.description')}</CardDescription>
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

export function WarehouseDialog({
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
      toast.success(
        creating
          ? t('master.warehouses.created')
          : t('master.warehouses.updated')
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
            {creating
              ? t('master.addWarehouse')
              : t('master.warehouses.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('master.warehouses.dialogDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='warehouse-name'>
              {t('master.warehouses.nameLabel')}
            </Label>
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
                <Label htmlFor='warehouse-active'>
                  {t('master.field.active')}
                </Label>
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
