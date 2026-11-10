import { Cross2Icon } from '@radix-ui/react-icons'
import { type Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import './types'
import { DataTableViewOptions } from './view-options'

export type DataTableFilter = {
  columnId: string
  title: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
}

type DataTableToolbarProps<TData> = {
  table: Table<TData>
  searchPlaceholder?: string
  filters?: DataTableFilter[]
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder,
  filters = [],
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    Boolean(table.getState().globalFilter)

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {searchPlaceholder && (
        <Input
          placeholder={searchPlaceholder}
          value={(table.getState().globalFilter as string) ?? ''}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className='h-8 w-full sm:w-62.5'
          aria-label={searchPlaceholder}
        />
      )}

      {filters.map((filter) => {
        const column = table.getColumn(filter.columnId)
        if (!column) return null
        return (
          <DataTableFacetedFilter
            key={filter.columnId}
            column={column}
            title={filter.title}
            options={filter.options}
          />
        )
      })}

      {isFiltered && (
        <Button
          variant='ghost'
          onClick={() => {
            table.resetColumnFilters()
            table.setGlobalFilter('')
          }}
          className='h-8 px-2 lg:px-3'
        >
          Atur ulang
          <Cross2Icon className='ms-2 size-4' />
        </Button>
      )}

      <DataTableViewOptions table={table} />
    </div>
  )
}
