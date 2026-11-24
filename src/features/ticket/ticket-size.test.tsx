import '@/styles/index.css'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PublicTicket } from '@/lib/api/types'
import { TicketCard } from './ticket-card'
import { buildTicketModel } from './ticket-model'
import { TICKET_DESIGNS, TICKET_HEIGHT } from './ticket-design'

/**
 * Kartu di layar dan PNG 2x harus berukuran sama. Kalau salah satu desain
 * tumbuh (misalnya karena field ditambah atau padding diubah) tanpa
 * `ticket-image.ts` ikut diubah, tiket yang diunduh supir akan terpotong atau
 * berbeda dari yang ia lihat di layar.
 *
 * Toleransi 2 px: pembulatan subpiksel peramban tidak selalu jatuh di angka
 * yang sama dengan kanvas, tetapi selisih sebesar itu tidak terlihat.
 */
const TOLERANCE = 2

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

describe('ukuran kartu tiket', () => {
  it('tidak lebih tinggi dari kanvas 2x di desain mana pun', async () => {
    const model = buildTicketModel(ticket, { appName: 'Warehouse TSB' })
    await render(
      <div style={{ width: 360 }}>
        {TICKET_DESIGNS.map((design) => (
          <div key={design} data-wrap={design}>
            <TicketCard model={model} design={design} />
          </div>
        ))}
      </div>
    )

    for (const design of TICKET_DESIGNS) {
      const card = document.querySelector(
        `[data-wrap="${design}"] [data-ticket-card]`
      )
      expect(card).not.toBeNull()
      const height = card!.getBoundingClientRect().height
      expect(
        Math.abs(height - TICKET_HEIGHT),
        `${design} setinggi ${height}px, kanvas ${TICKET_HEIGHT}px`
      ).toBeLessThanOrEqual(TOLERANCE)
    }
  })
})
