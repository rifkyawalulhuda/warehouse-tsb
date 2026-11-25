import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { TicketDesign } from '@/lib/api/types'
import { TICKET_DESIGNS } from '@/features/ticket/ticket-design'
import { TicketDesignPicker } from './ticket-design-picker'

describe('pemilih desain tiket', () => {
  it('menawarkan delapan desain dalam dua kelompok', async () => {
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
    const radios = [
      ...screen.container.querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ]
    expect(radios.map((radio) => radio.value)).toEqual([...TICKET_DESIGNS])

    // Diperiksa sebagai teks, bukan `getByText` per label: keterangan seperti
    // "gerbang malam" memuat kata yang sama dengan nama desainnya.
    const text = screen.container.textContent ?? ''
    for (const label of [
      'Klasik Biru',
      'Minimal Putih',
      'Navy Resmi',
      'Termal Mono',
      'Kode Besar',
      'Malam',
      'Pita Sobek',
      'Warna Merek',
    ]) {
      expect(text, `label "${label}" tidak tampil`).toContain(label)
    }
  })

  it('memisahkan tampilan standar dari desain untuk kondisi tertentu', async () => {
    const screen = await render(
      <TicketDesignPicker
        value='CLASSIC'
        onChange={() => undefined}
        appName='Warehouse TSB'
        logoUrl={null}
      />
    )

    // Delapan kartu berderet jadi satu dinding; pengelompokan memberi tahu
    // Admin bahwa tiga pertama adalah tampilan biasa, lima sisanya pengecualian.
    const text = screen.container.textContent ?? ''
    expect(text).toContain('Tampilan standar')
    expect(text).toContain('Untuk kondisi tertentu')
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

  it('menurunkan warna pita pratinjau dari warna merek halaman masuk', async () => {
    const screen = await render(
      <TicketDesignPicker
        value='BRAND'
        onChange={() => undefined}
        appName='Warehouse TSB'
        logoUrl={null}
        brandColor='#b45309'
      />
    )

    // Warna merek adalah isian bebas; pratinjau harus menunjukkan hasil
    // sesudah penjaga kontras, bukan hex mentah yang belum tentu terbaca.
    const card = screen.container.querySelector('[data-ticket-card]') as
      | HTMLElement
      | null
    expect(card?.style.getPropertyValue('--tk-band').trim()).toBe('#b45309')
  })
})
