import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { TicketDesign } from '@/lib/api/types'
import { TicketDesignPicker } from './ticket-design-picker'

describe('pemilih desain tiket', () => {
  it('menawarkan tiga desain sebagai satu kelompok pilihan', async () => {
    const screen = await render(
      <TicketDesignPicker
        value='CLASSIC'
        onChange={() => undefined}
        appName='Warehouse TSB'
        logoUrl={null}
      />
    )

    // Radio asli, bukan tombol: kelompoknya terbaca sebagai satu pertanyaan dan
    // panah keyboard bekerja tanpa penanganan tambahan.
    expect(screen.container.querySelectorAll('input[type=radio]')).toHaveLength(
      3
    )
    await expect.element(screen.getByText('Klasik Biru')).toBeInTheDocument()
    await expect.element(screen.getByText('Minimal Putih')).toBeInTheDocument()
    await expect.element(screen.getByText('Navy Resmi')).toBeInTheDocument()
  })

  it('melaporkan desain yang dipilih, bukan yang sedang aktif', async () => {
    const picked: TicketDesign[] = []
    const screen = await render(
      <TicketDesignPicker
        value='CLASSIC'
        onChange={(design) => picked.push(design)}
        appName='Warehouse TSB'
        logoUrl={null}
      />
    )

    await userEvent.click(screen.getByText('Navy Resmi'))
    expect(picked).toEqual(['NAVY'])
  })

  it('pratinjau mengikuti desain aktif, bukan desain bawaan', async () => {
    const screen = await render(
      <TicketDesignPicker
        value='MINIMAL'
        onChange={() => undefined}
        appName='Warehouse TSB'
        logoUrl={null}
      />
    )

    const card = screen.container.querySelector('[data-ticket-card]')
    expect(card?.getAttribute('data-ticket-design')).toBe('MINIMAL')
  })

  it('memakai data contoh, bukan data booking asli', async () => {
    const screen = await render(
      <TicketDesignPicker
        value='CLASSIC'
        onChange={() => undefined}
        appName='Warehouse TSB'
        logoUrl={null}
      />
    )

    // Nama aplikasi milik admin sendiri ikut terlihat, supaya panjang judul
    // yang bermasalah ketahuan sebelum disimpan.
    await expect.element(screen.getByText('Warehouse TSB')).toBeInTheDocument()
    await expect.element(screen.getByText('PT Contoh Nusantara')).toBeInTheDocument()
  })
})
