import type { RowData } from '@tanstack/react-table'

/**
 * Metadata kolom yang dipakai `DataTable` untuk hal-hal yang bukan urusan
 * TanStack Table: label bahasa Indonesia di daftar "Tampilkan kolom" dan kelas
 * perataan yang dulu ditulis langsung di `<TableHead>`/`<TableCell>`.
 */
declare module '@tanstack/react-table' {
  // Parameter tipe wajib ada untuk memenuhi deklarasi aslinya, walau tidak
  // dipakai di sini.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Label manusiawi; tanpa ini daftar kolom memakai id mentah. */
    label?: string
    /** Kelas untuk `<TableHead>`, mis. `text-end`. */
    headerClassName?: string
    /** Kelas untuk `<TableCell>`, mis. `text-end tabular-nums`. */
    cellClassName?: string
  }
}
