/**
 * Tab Jenis Proses: durasi tambahan per jenis proses.
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
import { createProcessType, updateProcessType } from '@/lib/api/endpoints'
import type { ProcessType } from '@/lib/api/types'
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

export function ProcessTypeSection({
  query,
  onEdit,
  onCreate,
}: {
  query: UseQueryResult<ProcessType[]>
  onEdit: (type: ProcessType) => void
  onCreate: () => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(false)

  const types = query.data
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (types ?? []).filter((type) => {
      const matchesTerm = term === '' || type.name.toLowerCase().includes(term)
      const matchesActive = !onlyActive || type.isActive
      return matchesTerm && matchesActive
    })
  }, [types, search, onlyActive])

  const activeCount = (types ?? []).filter((type) => type.isActive).length

  const columns: ColumnDef<ProcessType>[] = [
    {
      accessorKey: 'name',
      meta: { label: t('master.process.name'), cellClassName: 'font-medium' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.process.name')}
        />
      ),
    },
    {
      accessorKey: 'durationMinutes',
      meta: { label: t('master.process.duration') },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('master.process.duration')}
        />
      ),
      cell: ({ row }) => (
        <span className='text-sm tabular-nums'>
          +{durationLabel(row.original.durationMinutes)}
        </span>
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
        <CardTitle className='text-base'>{t('master.process.title')}</CardTitle>
        <CardDescription>{t('master.process.description')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <SectionToolbar
          search={search}
          onSearch={setSearch}
          placeholder={t('master.process.search')}
          actionLabel={t('master.addProcess')}
          onAction={onCreate}
        >
          <label className='flex cursor-pointer items-center gap-2 text-sm'>
            <Switch
              checked={onlyActive}
              onCheckedChange={setOnlyActive}
              aria-label={t('master.process.onlyActive')}
            />
            {t('master.process.onlyActive')}
          </label>
        </SectionToolbar>

        {query.data && activeCount === 0 && (
          <p className='rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'>
            {t('master.process.noneActive')}
          </p>
        )}

        {query.isPending ? (
          <LoadingBlock label={t('master.process.loading')} />
        ) : query.isError ? (
          <ErrorBlock
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(type) => String(type.id)}
            emptyMessage={
              (types?.length ?? 0) === 0
                ? t('master.process.empty')
                : t('master.process.noMatch')
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Dialog ubah/tambah jenis proses. `key` di pemanggilnya menyegarkan state form
 * tiap baris dibuka.
 */
export function ProcessTypeDialog({
  type,
  onDone,
  onChanged,
}: {
  type: ProcessType | null
  onDone: () => void
  onChanged: () => void
}) {
  const t = useT()
  const creating = type === null
  const [name, setName] = useState(type?.name ?? '')
  const [duration, setDuration] = useState(String(type?.durationMinutes ?? 15))
  const [sortOrder, setSortOrder] = useState(String(type?.sortOrder ?? 1))
  const [isActive, setIsActive] = useState(type?.isActive ?? true)

  const minutes = Number(duration)
  const valid =
    name.trim().length >= 2 &&
    Number.isInteger(minutes) &&
    minutes >= 1 &&
    minutes <= 480 &&
    Number.isInteger(Number(sortOrder))

  const dirty =
    creating ||
    name.trim() !== type.name ||
    minutes !== type.durationMinutes ||
    Number(sortOrder) !== type.sortOrder ||
    isActive !== type.isActive

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        durationMinutes: minutes,
        sortOrder: Number(sortOrder),
        isActive,
      }
      return creating
        ? createProcessType(payload)
        : updateProcessType(type.id, payload)
    },
    onSuccess: () => {
      toast.success(
        creating ? t('master.process.created') : t('master.process.updated')
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
              ? t('master.process.newTitle')
              : t('master.process.editTitle', {
                  name: type.name,
                })}
          </DialogTitle>
          <DialogDescription>
            {creating
              ? t('master.process.newDescription')
              : t('master.process.editHint')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='process-type-name'>
              {t('master.process.nameLabel')}
            </Label>
            <Input
              id='process-type-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              placeholder={t('master.process.namePlaceholder')}
              autoFocus
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='process-type-duration'>
                {t('master.process.durationLabel')}
              </Label>
              <Input
                id='process-type-duration'
                type='number'
                min={1}
                max={480}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='process-type-sort'>
                {t('master.process.sortLabel')}
              </Label>
              <Input
                id='process-type-sort'
                type='number'
                min={0}
                max={99}
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
          </div>

          <p className='text-sm text-muted-foreground'>
            {Number.isInteger(minutes) && minutes >= 1 && minutes <= 480
              ? t('master.process.durationHint')
              : t('master.process.minDurationHint')}
          </p>

          <div className='flex items-center justify-between gap-4 rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='process-type-active'>
                {t('master.process.activeLabel')}
              </Label>
              <p className='text-xs text-muted-foreground'>
                {t('master.process.editHint')}
              </p>
            </div>
            <Switch
              id='process-type-active'
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
 * Jenis truk diambil dari `/api/master/truck-types`, bukan `/api/settings`.
 * Settings hanya mengembalikan yang `isActive`, jadi memakai settings akan
 * membuat jenis truk yang dinonaktifkan hilang dari layar dan mustahil
 * diaktifkan kembali.
 */
