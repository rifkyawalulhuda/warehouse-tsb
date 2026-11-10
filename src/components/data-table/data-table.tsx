import { Fragment, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableBulkActions } from './bulk-actions'
import { DataTablePagination } from './pagination'
import { DataTableToolbar, type DataTableFilter } from './toolbar'
import './types'

export type DataTableProps<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  /** Ditampilkan saat tidak ada baris sama sekali, atau saat filter kosong. */
  emptyMessage?: string
  /** Placeholder pencarian global. Kosongkan untuk mematikan pencarian. */
  searchPlaceholder?: string
  filters?: DataTableFilter[]
  pageSize?: number
  initialSorting?: SortingState
  /** Wajib untuk tabel berseleksi supaya pilihan tidak bergeser saat difilter. */
  getRowId?: (row: TData) => string
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  /** Bar aksi massal; hanya dirender saat ada baris terpilih. */
  renderBulkActions?: (
    selectedIds: string[],
    clearSelection: () => void
  ) => React.ReactNode
  /**
   * Pengelompokan baris dengan judul grup di atas setiap kelompok. Grup diurut
   * menurut nama supaya daftar dock tidak melompat-lompat antar gudang.
   */
  groupBy?: (row: TData) => string
  /** Pengganti tampilan judul grup, mis. untuk menambahkan ikon. */
  groupLabel?: (name: string, count: number) => React.ReactNode
  className?: string
}

/**
 * Tabel data berbasis TanStack Table dengan primitif shadcn.
 *
 * Sengaja tidak memasang toolbar pencarian sendiri di halaman yang sudah punya
 * filter tanggal di server (Laporan, Riwayat Gate, Antrean): dua filter dengan
 * sumber berbeda membuat hasil kosong tidak bisa dijelaskan.
 */
export function DataTable<TData>({
  columns,
  data,
  emptyMessage = 'Tidak ada data.',
  searchPlaceholder,
  filters = [],
  pageSize = 10,
  initialSorting = [],
  getRowId,
  rowSelection,
  onRowSelectionChange,
  renderBulkActions,
  groupBy,
  groupLabel,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>(
    {}
  )

  const selection = rowSelection ?? internalSelection
  const setSelection = onRowSelectionChange ?? setInternalSelection

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table mengembalikan fungsi yang tidak bisa dimemo; ini komponen daun, bukan nilai yang diteruskan ke hook lain.
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, rowSelection: selection, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    // `sortUndefined` adalah opsi **kolom**, bukan opsi tabel: kalau ditulis di
    // sini nilainya diabaikan dan nilai kosong terurut sebagai string
    // "undefined". Lewat `defaultColumn` ia sampai ke setiap kolom, sehingga
    // baris tanpa durasi tetap di bawah baik menaik maupun menurun.
    defaultColumn: { sortUndefined: 'last' },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  })

  const rows = table.getRowModel().rows
  const totalColumns = table.getVisibleLeafColumns().length
  const selectedIds = Object.keys(selection)

  const groups = groupBy
    ? (() => {
        const buckets = new Map<string, Row<TData>[]>()
        for (const row of rows) {
          const key = groupBy(row.original)
          const bucket = buckets.get(key)
          if (bucket) bucket.push(row)
          else buckets.set(key, [row])
        }
        return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))
      })()
    : null

  const renderRow = (row: Row<TData>) => (
    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cell.column.columnDef.meta?.cellClassName}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )

  return (
    <div className={cn('@container/content flex flex-col gap-3', className)}>
      <DataTableToolbar
        table={table}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
      />

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={header.column.columnDef.meta?.headerClassName}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={totalColumns}
                className='py-8 text-center text-sm text-muted-foreground'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : groups ? (
            groups.map(([name, groupRows]) => (
              <Fragment key={`group-${name}`}>
                <TableRow className='bg-muted/40 hover:bg-muted/40'>
                  <TableCell colSpan={totalColumns} className='py-1.5'>
                    <span className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                      {groupLabel ? (
                        groupLabel(name, groupRows.length)
                      ) : (
                        <>
                          {name}
                          <span className='tabular-nums'>
                            ({groupRows.length})
                          </span>
                        </>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
                {groupRows.map(renderRow)}
              </Fragment>
            ))
          ) : (
            rows.map(renderRow)
          )}
        </TableBody>
      </Table>

      {table.getPageCount() > 1 && <DataTablePagination table={table} />}

      {renderBulkActions && (
        <DataTableBulkActions
          count={selectedIds.length}
          onClear={() => setSelection({})}
          entityName='baris'
        >
          {renderBulkActions(selectedIds, () => setSelection({}))}
        </DataTableBulkActions>
      )}
    </div>
  )
}
