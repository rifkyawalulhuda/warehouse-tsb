/**
 * Tab Dock: daftar dock, statusnya, dan dialog tambah/ubah.
 *
 * Dipisah dari `index.tsx` supaya tiap tab Master Data punya berkasnya sendiri;
 * berkas gabungannya dulu 2171 baris dan 12 komponen.
 */
import { useState } from 'react'
import { useMutation, type UseQueryResult } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import {
  ArrowDownUp,
  Loader2,
  PencilLine,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { createDock, updateDock, type fetchDocks } from '@/lib/api/endpoints'
import type { Dock, Warehouse } from '@/lib/api/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { SectionToolbar } from './shared'

export function DockSection({
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
        <DataTableColumnHeader
          column={column}
          title={t('master.docks.warehouse')}
        />
      ),
      cell: ({ row }) => row.original.warehouse?.name ?? '—',
    },
    {
      id: 'activity',
      accessorFn: (dock) => dock.allowedActivity,
      enableGlobalFilter: false,
      meta: { label: t('master.docks.serves') },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.docks.serves')}
        />
      ),
      cell: ({ row }) => (
        <div className='flex flex-wrap gap-1'>
          {(row.original.allowedActivity === 'BOTH'
            ? ['LOADING', 'UNLOADING']
            : [row.original.allowedActivity]
          ).map((item) => (
            <Badge key={item} variant='outline' className='font-normal'>
              {t(
                item === 'LOADING' ? 'activity.LOADING' : 'activity.UNLOADING'
              )}
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
        <DataTableColumnHeader
          column={column}
          title={t('master.field.status')}
        />
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
              <SelectItem value='ALL'>
                {t('master.docks.allActivities')}
              </SelectItem>
              <SelectItem value='LOADING'>{t('activity.LOADING')}</SelectItem>
              <SelectItem value='UNLOADING'>
                {t('activity.UNLOADING')}
              </SelectItem>
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
                    ? (dock) =>
                        dock.warehouse?.name ??
                        t('master.docks.withoutWarehouse')
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
                        {t(
                          item === 'LOADING'
                            ? 'activity.LOADING'
                            : 'activity.UNLOADING'
                        )}
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
                          aria-label={t('master.docks.statusAriaShort', {
                            code: dock.dockCode,
                          })}
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
 * Daftar "Jenis Proses" — cara penanganan barang di dock (Curah, Palletize).
 *
 * Berbeda dari jenis truk, durasi di sini **menambah** dan tidak punya angka
 * blok sendiri: blok yang dikunci bergantung pada pasangan truk + proses, jadi
 * baru dihitung saat booking dibuat. Menampilkan "blok" di sini akan menyesatkan
 * karena 30 menit tidak selalu berarti satu blok.
 */

export function DockDialog({
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
      toast.success(
        creating ? t('master.docks.created') : t('master.docks.updated')
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
              ? t('master.addDock')
              : t('master.docks.editTitle', { code: dock.dockCode })}
          </DialogTitle>
          <DialogDescription>{t('master.docks.dialogDesc')}</DialogDescription>
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
            <Label htmlFor='dock-activity'>
              {t('master.docks.servesLabel')}
            </Label>
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
                <SelectItem value='UNLOADING'>
                  {t('activity.UNLOADING')}
                </SelectItem>
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
