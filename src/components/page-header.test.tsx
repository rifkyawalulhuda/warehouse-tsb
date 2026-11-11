import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { PageHeader } from './page-header'

describe('PageHeader', () => {
  it('menampilkan nama perusahaan sebagai baris kecil di atas judul', async () => {
    const screen = await render(
      <PageHeader
        eyebrow='PT Sinar Jaya Logistik'
        title='Jadwal Saya'
        description='Semua booking truk yang Anda buat.'
      />
    )

    await expect.element(screen.getByText('PT Sinar Jaya Logistik')).toBeVisible()
    await expect
      .element(screen.getByRole('heading', { name: 'Jadwal Saya' }))
      .toBeInTheDocument()
  })

  it('tidak meninggalkan baris kosong bila tidak ada nama perusahaan', async () => {
    const screen = await render(<PageHeader title='Jadwal Saya' />)

    // Tanpa eyebrow, isi header hanya judulnya — tidak ada elemen kosong yang
    // menyisakan jarak aneh di halaman staf.
    expect(screen.container.textContent).toBe('Jadwal Saya')
  })
})
