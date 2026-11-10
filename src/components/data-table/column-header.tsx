import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
} from '@radix-ui/react-icons'
import { type Column } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import './types'

type DataTableColumnHeaderProps<TData, TValue> =
  React.HTMLAttributes<HTMLDivElement> & {
    column: Column<TData, TValue>
    title: string
  }

/**
 * Judul kolom yang bisa diurutkan.
 *
 * Memakai satu klik untuk naik → turun → kembali, bukan dropdown: dropdown di
 * setiap judul membuat tabel padat terasa seperti kumpulan menu, dan aksi
 * sembunyikan kolom sudah tersedia sekali di toolbar.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={cn(className)}>{title}</span>
  }

  const sorted = column.getIsSorted()

  return (
    <Button
      variant='ghost'
      size='sm'
      className={cn('-ms-2 h-8 px-2 font-medium', className)}
      onClick={() => column.toggleSorting(sorted === 'asc')}
      title={`Urutkan ${title.toLowerCase()}`}
      aria-label={`Urutkan ${title.toLowerCase()}, ${sorted === 'asc' ? 'menaik' : sorted === 'desc' ? 'menurun' : 'belum diurutkan'}`}
    >
      {title}
      {sorted === 'desc' ? (
        <ArrowDownIcon className='ms-1.5 size-3.5' />
      ) : sorted === 'asc' ? (
        <ArrowUpIcon className='ms-1.5 size-3.5' />
      ) : (
        <CaretSortIcon className='ms-1.5 size-3.5 opacity-50' />
      )}
    </Button>
  )
}
