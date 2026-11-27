/**
 * Tab Jenis Truk: durasi dan jumlah blok per jenis truk.
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
import { createTruckType, updateTruckType } from '@/lib/api/endpoints'
import type { TruckType } from '@/lib/api/types'
import { durationLabel } from '@/lib/format'
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

export function TruckTypeSection({
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
        <DataTableColumnHeader
          column={column}
          title={t('master.trucks.type')}
        />
      ),
    },
    {
      accessorKey: 'durationMinutes',
      meta: { label: t('master.trucks.duration') },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.trucks.duration')}
        />
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
        <DataTableColumnHeader
          column={column}
          title={t('master.field.sortOrder')}
        />
      ),
    },
    {
      id: 'status',
      accessorFn: (type) => type.isActive,
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
export function TruckTypeDialog({
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
              ? t('master.trucks.newDescription', { minutes: slotUnitMinutes })
              : t('master.trucks.editHint')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='truck-type-name'>
              {t('master.trucks.nameLabel')}
            </Label>
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
              <Label htmlFor='truck-type-duration'>
                {t('master.trucks.durationLabel')}
              </Label>
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
              <Label htmlFor='truck-type-sort'>
                {t('master.trucks.sortLabel')}
              </Label>
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
              <Label htmlFor='truck-type-active'>
                {t('master.field.active')}
              </Label>
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
