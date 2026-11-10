import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { cn, getPageNumbers } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DataTablePaginationProps<TData> = {
  table: Table<TData>
  className?: string
}

export function DataTablePagination<TData>({
  table,
  className,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-1',
        className
      )}
    >
      <div className='flex items-center gap-2'>
        <span className='hidden text-sm text-muted-foreground sm:inline'>
          Baris per halaman
        </span>
        <Select
          value={`${table.getState().pagination.pageSize}`}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger className='h-8 w-17.5' aria-label='Baris per halaman'>
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side='top'>
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex items-center gap-1'>
        <span className='me-1 text-sm text-muted-foreground tabular-nums'>
          {currentPage} / {totalPages}
        </span>
        <Button
          variant='outline'
          className='hidden size-8 p-0 sm:inline-flex'
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label='Halaman pertama'
        >
          <DoubleArrowLeftIcon className='size-4' />
        </Button>
        <Button
          variant='outline'
          className='size-8 p-0'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label='Halaman sebelumnya'
        >
          <ChevronLeftIcon className='size-4' />
        </Button>

        {pageNumbers.map((pageNumber, index) =>
          pageNumber === '...' ? (
            <span
              key={`gap-${index}`}
              className='px-1 text-sm text-muted-foreground'
            >
              …
            </span>
          ) : (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? 'default' : 'outline'}
              className='hidden h-8 min-w-8 px-2 tabular-nums sm:inline-flex'
              onClick={() => table.setPageIndex((pageNumber as number) - 1)}
              aria-label={`Halaman ${pageNumber}`}
              aria-current={currentPage === pageNumber ? 'page' : undefined}
            >
              {pageNumber}
            </Button>
          )
        )}

        <Button
          variant='outline'
          className='size-8 p-0'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label='Halaman berikutnya'
        >
          <ChevronRightIcon className='size-4' />
        </Button>
        <Button
          variant='outline'
          className='hidden size-8 p-0 sm:inline-flex'
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          aria-label='Halaman terakhir'
        >
          <DoubleArrowRightIcon className='size-4' />
        </Button>
      </div>
    </div>
  )
}
