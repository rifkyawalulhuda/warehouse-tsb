import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { DataTable, DataTableColumnHeader } from '.'

type Row = { code: string; minutes?: number; warehouse?: string }

const rows: Row[] = [
  { code: 'A-1', minutes: 110, warehouse: 'Gudang B' },
  { code: 'B-2', minutes: 12, warehouse: 'Gudang A' },
  { code: 'C-3', minutes: undefined, warehouse: 'Gudang A' },
]

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: 'code',
    meta: { label: 'Kode' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Kode' />
    ),
  },
  {
    accessorKey: 'minutes',
    enableGlobalFilter: false,
    meta: { label: 'Menit' },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Menit' />
    ),
    cell: ({ row }) => row.original.minutes ?? '-',
  },
]

const codes = (element: HTMLElement) =>
  [...element.querySelectorAll('tbody tr td:first-child')].map(
    (cell) => cell.textContent
  )

const minutes = (element: HTMLElement) =>
  [...element.querySelectorAll('tbody tr td:nth-child(2)')].map(
    (cell) => cell.textContent
  )

describe('DataTable', () => {
  it('mengurutkan angka secara numerik dan menaruh nilai kosong di akhir', async () => {
    const screen = await render(
      <DataTable columns={columns} data={rows} pageSize={10} />
    )

    await userEvent.click(screen.getByRole('button', { name: /Urutkan menit/ }))

    // Kalau accessor-nya string, "110" akan mendahului "12".
    expect(minutes(screen.container as HTMLElement)).toEqual(['12', '110', '-'])

    // Menurun tidak boleh membalik nilai kosong ke atas: `sortUndefined` harus
    // dioper lewat `defaultColumn`, bukan opsi tabel yang diabaikan TanStack.
    await userEvent.click(screen.getByRole('button', { name: /Urutkan menit/ }))

    expect(minutes(screen.container as HTMLElement)).toEqual(['110', '12', '-'])
  })

  it('membagi baris ke beberapa halaman', async () => {
    const screen = await render(
      <DataTable columns={columns} data={rows} pageSize={2} />
    )

    expect(codes(screen.container as HTMLElement)).toEqual(['A-1', 'B-2'])

    await userEvent.click(
      screen.getByRole('button', { name: 'Halaman berikutnya' })
    )

    expect(codes(screen.container as HTMLElement)).toEqual(['C-3'])
  })

  it('tidak menampilkan kotak pencarian kalau halaman punya filter sendiri', async () => {
    const screen = await render(<DataTable columns={columns} data={rows} />)

    expect(screen.container.querySelector('input')).toBeNull()
  })

  it('menyaring baris lewat kotak pencarian saat diminta', async () => {
    const screen = await render(
      <DataTable columns={columns} data={rows} searchPlaceholder='Cari kode' />
    )

    await userEvent.fill(screen.getByPlaceholder('Cari kode'), 'B-2')

    expect(codes(screen.container as HTMLElement)).toEqual(['B-2'])
  })

  it('mengelompokkan baris dan menghitung isi tiap kelompok', async () => {
    const screen = await render(
      <DataTable
        columns={columns}
        data={rows}
        groupBy={(row) => row.warehouse ?? 'Tanpa gudang'}
      />
    )

    await expect.element(screen.getByText('Gudang A')).toBeInTheDocument()
    await expect.element(screen.getByText('(2)')).toBeInTheDocument()
    await expect.element(screen.getByText('Gudang B')).toBeInTheDocument()
  })

  it('menampilkan aksi massal hanya setelah ada baris dipilih', async () => {
    const screen = await render(
      <DataTable
        columns={[
          {
            id: 'select',
            enableSorting: false,
            header: ({ table }) => (
              <input
                type='checkbox'
                aria-label='Pilih semua'
                checked={table.getIsAllPageRowsSelected()}
                onChange={(event) =>
                  table.toggleAllPageRowsSelected(event.target.checked)
                }
              />
            ),
            cell: ({ row }) => (
              <input
                type='checkbox'
                aria-label={`Pilih ${row.original.code}`}
                checked={row.getIsSelected()}
                onChange={(event) => row.toggleSelected(event.target.checked)}
              />
            ),
          },
          ...columns,
        ]}
        data={rows}
        getRowId={(row) => row.code}
        renderBulkActions={(ids, clear) => (
          <button type='button' onClick={clear}>
            Setujui {ids.length}
          </button>
        )}
      />
    )

    expect(screen.container.textContent).not.toContain('Setujui 1')

    await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih B-2' }))

    await expect.element(screen.getByText('Setujui 1')).toBeInTheDocument()
  })

  it('menyembunyikan kolom lewat menu Kolom', async () => {
    const screen = await render(<DataTable columns={columns} data={rows} />)

    const countColumns = () =>
      (screen.container as HTMLElement).querySelectorAll('thead th').length

    expect(countColumns()).toBe(2)

    await userEvent.click(screen.getByRole('button', { name: /Kolom/i }))
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Menit' })
    )

    expect(countColumns()).toBe(1)
  })

  it('kembali ke halaman pertama saat filter di luar tabel mempersempit data', async () => {
    // Halaman Laporan dan Riwayat menyaring di server, di luar DataTable. Kalau
    // pengguna sedang di halaman 2 lalu memperkecil rentang tanggal, tabel harus
    // kembali ke halaman 1 — bukan menampilkan halaman kosong.
    const screen = await render(
      <DataTable columns={columns} data={rows} pageSize={2} />
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Halaman berikutnya' })
    )
    expect(codes(screen.container as HTMLElement)).toEqual(['C-3'])

    await screen.rerender(
      <DataTable columns={columns} data={[rows[0]]} pageSize={2} />
    )

    expect(codes(screen.container as HTMLElement)).toEqual(['A-1'])
  })

  it('menjaga baris terpilih saat berpindah halaman', async () => {
    // Halaman Persetujuan memilih lintas halaman sebelum menyetujui sekaligus.
    // Tanpa `getRowId`, id baris diturunkan dari indeks dan pilihan menempel ke
    // baris yang salah setelah halaman berganti.
    const screen = await render(
      <DataTable
        columns={[
          {
            id: 'select',
            enableSorting: false,
            header: ({ table }) => (
              <input
                type='checkbox'
                aria-label='Pilih semua'
                checked={table.getIsAllPageRowsSelected()}
                onChange={(event) =>
                  table.toggleAllPageRowsSelected(event.target.checked)
                }
              />
            ),
            cell: ({ row }) => (
              <input
                type='checkbox'
                aria-label={`Pilih ${row.original.code}`}
                checked={row.getIsSelected()}
                onChange={(event) => row.toggleSelected(event.target.checked)}
              />
            ),
          },
          ...columns,
        ]}
        data={rows}
        pageSize={2}
        getRowId={(row) => row.code}
        renderBulkActions={(ids) => <span>Terpilih {ids.join(',')}</span>}
      />
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih A-1' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Halaman berikutnya' })
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pilih C-3' }))

    await expect
      .element(screen.getByText('Terpilih A-1,C-3'))
      .toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Halaman sebelumnya' })
    )

    await expect
      .element(screen.getByRole('checkbox', { name: 'Pilih A-1' }))
      .toBeChecked()
  })

  it('memberi pesan kosong yang bisa disesuaikan', async () => {
    const screen = await render(
      <DataTable
        columns={columns}
        data={[]}
        emptyMessage='Tidak ada peristiwa gate pada rentang ini.'
      />
    )

    await expect
      .element(screen.getByText('Tidak ada peristiwa gate pada rentang ini.'))
      .toBeInTheDocument()
  })
})
