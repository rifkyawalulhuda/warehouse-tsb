/**
 * Potongan tampilan yang dipakai lebih dari satu tab Master Data.
 *
 * Dipisah dari `index.tsx` supaya tiap tab Master Data punya berkasnya sendiri;
 * berkas gabungannya dulu 2171 baris dan 12 komponen.
 */
import { type ReactNode } from 'react'
import { Plus, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const summaryTone = {
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  indigo:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  violet:
    'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  emerald:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
} as const

export function SummaryCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  unit: string
  hint: string
  tone: keyof typeof summaryTone
}) {
  return (
    <Card className='gap-2 py-4'>
      <CardContent className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <p className='truncate text-sm font-medium text-muted-foreground'>
            {label}
          </p>
          <p className='flex items-baseline gap-1'>
            <span className='text-2xl font-semibold tabular-nums'>{value}</span>
            <span className='text-xs font-medium text-muted-foreground'>
              {unit}
            </span>
          </p>
          <p className='line-clamp-2 text-[11px] text-muted-foreground'>
            {hint}
          </p>
        </div>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            summaryTone[tone]
          )}
        >
          <Icon className='size-4.5' />
        </span>
      </CardContent>
    </Card>
  )
}

/** Toolbar seragam untuk ketiga tab: pencarian di kiri, aksi utama di kanan. */
export function SectionToolbar({
  search,
  onSearch,
  placeholder,
  actionLabel,
  onAction,
  children,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  actionLabel: string
  onAction: () => void
  children?: ReactNode
}) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-1 flex-col gap-2 sm:flex-row sm:items-center'>
        <div className='relative w-full sm:max-w-xs'>
          <Search className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            className='pl-8'
            aria-label={placeholder}
          />
        </div>
        {children}
      </div>
      <Button onClick={onAction} className='sm:shrink-0'>
        <Plus />
        {actionLabel}
      </Button>
    </div>
  )
}
