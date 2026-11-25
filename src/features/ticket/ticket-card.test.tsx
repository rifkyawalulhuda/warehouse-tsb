import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PublicTicket } from '@/lib/api/types'
import { TicketCard } from './ticket-card'
import { TICKET_DESIGNS } from './ticket-design'
import { buildTicketModel } from './ticket-model'

const ticket: PublicTicket = {
  bookingCode: 'TSB-20261111-003',
  qrToken: 'abcdefghijklmnopqrstuvwxyz012345',
  status: 'BOOKED_READY',
  approvalStatus: 'NOT_REQUIRED',
  rejectionReason: null,
  activityType: 'LOADING',
  bookingDate: '2026-11-11',
  startTime: '2026-11-11T01:30:00.000Z',
  endTime: '2026-11-11T02:30:00.000Z',
  referenceDocNo: 'D3133232',
  licensePlate: 'B 3434 TT',
  driverName: 'Udin',
  customerName: 'PT Sinar Jaya Logistik',
  truckType: { truckName: 'Fuso', durationMinutes: 60 },
  dockCode: 'L1',
  dockAreaName: null,
  lateMinutes: 0,
  vehicleComplete: true,
  warehouseName: 'Gudang Cikarang',
  gracePeriodMinutes: 15,
  timeLog: null,
}

describe('kartu tiket', () => {
  it('memuat identitas booking, bukan hanya gambar QR', async () => {
    const screen = await render(<TicketCard model={buildTicketModel(ticket)} />)

    await expect
      .element(screen.getByText('TSB-20261111-003'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText(/PT Sinar Jaya Logistik · Gudang Cikarang/))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Tunjukkan QR ini di gerbang'))
      .toBeInTheDocument()
  })

  it('menampilkan data yang dibutuhkan petugas gate', async () => {
    const screen = await render(<TicketCard model={buildTicketModel(ticket)} />)

    for (const value of [
      'Rab, 11 Nov 2026',
      'B 3434 TT',
      'Udin',
      'L1',
      'D3133232',
      'Fuso',
    ]) {
      await expect.element(screen.getByText(value)).toBeInTheDocument()
    }
  })

  it('menyebut area di samping kode dock supaya supir tahu lokasinya', async () => {
    const model = buildTicketModel({
      ...ticket,
      dockAreaName: 'Area Tengah',
    })

    const screen = await render(<TicketCard model={model} />)

    await expect
      .element(screen.getByText('L1 · Area Tengah'))
      .toBeInTheDocument()
  })

  it('memakai tanda hubung saat plat atau supir belum diisi', async () => {
    const model = buildTicketModel({
      ...ticket,
      licensePlate: null,
      driverName: null,
      dockCode: null,
    })

    const screen = await render(<TicketCard model={model} />)

    await expect
      .element(screen.getByText('Belum ditentukan'))
      .toBeInTheDocument()
    const dashes = [...screen.container.querySelectorAll('dd')].filter(
      (cell) => cell.textContent === '-'
    )
    expect(dashes).toHaveLength(2)
  })
})

describe('delapan desain tiket', () => {
  const model = buildTicketModel(ticket)

  it('memakai Klasik saat desain tidak disebut', async () => {
    const screen = await render(<TicketCard model={model} />)
    expect(
      screen.container
        .querySelector('[data-ticket-design]')
        ?.getAttribute('data-ticket-design')
    ).toBe('CLASSIC')
  })

  for (const design of TICKET_DESIGNS) {
    it(`tetap memuat data yang dibutuhkan gate di desain ${design}`, async () => {
      const screen = await render(<TicketCard model={model} design={design} />)
      const text = screen.container.textContent ?? ''

      // Diperiksa sebagai teks kartu, bukan satu elemen: desain Pita Sobek
      // sengaja mengulang kode, plat, dan supir di stubnya, jadi `getByText`
      // tunggal akan menemukan dua elemen dan gagal. Yang penting di sini
      // adalah datanya ada, bukan berapa kali ia muncul.
      for (const value of [
        'TSB-20261111-003',
        'Loading (muat)',
        'Fuso',
        'B 3434 TT',
        'Udin',
        'L1',
        'D3133232',
        'PT Sinar Jaya Logistik',
        'Gudang Cikarang',
      ]) {
        expect(text, `${design} tidak memuat "${value}"`).toContain(value)
      }

      // QR tetap ada dan tetap memuat token, bukan hiasan.
      expect(screen.container.querySelector('svg')).toBeTruthy()
    })
  }

  it('menaruh tanggal besar di samping QR pada desain Minimal', async () => {
    const screen = await render(<TicketCard model={model} design='MINIMAL' />)

    await expect.element(screen.getByText('11 Nov 2026')).toBeInTheDocument()
    await expect.element(screen.getByText('Rab')).toBeInTheDocument()
    // Jam ditulis sesuai bahasa aktif ("08.30" vs "08:30"), jadi dibandingkan
    // dengan nilai model, bukan teks yang dipatok di tes.
    await expect.element(screen.getByText(model.schedule)).toBeInTheDocument()
  })

  it('mengulang kode dan dock di stub desain Pita Sobek', async () => {
    const screen = await render(<TicketCard model={model} design='TEAROFF' />)
    const stub = screen.container.querySelector('.bg-\\[var\\(--tk-stub\\)\\]')

    // Stub dipisah petugas gate, jadi isinya harus berdiri sendiri: kode, dock,
    // tanggal, jam, plat, dan supir tanpa bergantung pada bagian atas kartu.
    expect(stub).not.toBeNull()
    const text = stub!.textContent ?? ''
    expect(text).toContain('TSB-20261111-003')
    expect(text).toContain('L1')
    expect(text).toContain('B 3434 TT')
    expect(text).toContain('Udin')
  })

  it('tidak menampilkan logo dari domain lain', async () => {
    // Kanvas tidak bisa membaca piksel domain lain, jadi logonya akan hilang di
    // PNG. Menolaknya juga di layar membuat keduanya sama-sama tanpa logo,
    // bukan tiket yang berubah saat diunduh.
    const external = await render(
      <TicketCard model={model} logoUrl='https://cdn.contoh.com/logo.png' />
    )
    expect(external.container.querySelector('img')).toBeNull()

    const own = await render(
      <TicketCard model={model} logoUrl='/api/uploads/logo-abc.png' />
    )
    expect(own.container.querySelector('img')).not.toBeNull()
  })

  it('menaruh kode booking di alas putih pada desain Malam', async () => {
    const screen = await render(<TicketCard model={model} design='NIGHT' />)
    const card = screen.container.querySelector('[data-ticket-card]')

    // QR terbalik (modul terang di atas gelap) gagal di sebagian pemindai,
    // jadi pembungkus QR-nya harus tetap putih walau kartunya gelap.
    expect(card?.className).toContain('bg-[var(--tk-night)]')
    const qrBox = screen.container.querySelector('svg')?.parentElement
    expect(qrBox?.className).toContain('bg-white')
  })
})
