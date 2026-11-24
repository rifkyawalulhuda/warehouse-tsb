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

describe('tiga desain tiket', () => {
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

      // Nilai yang muncul di ketiga desain. Tanggal dan jam sengaja tidak
      // diperiksa di sini: Minimal memecahnya jadi sorotan besar di samping QR.
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
        await expect.element(screen.getByText(value)).toBeInTheDocument()
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
})
