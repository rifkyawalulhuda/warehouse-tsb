import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PublicTicket } from '@/lib/api/types'
import { TicketCard } from './ticket-card'
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
