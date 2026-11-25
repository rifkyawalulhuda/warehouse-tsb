import '@/styles/index.css'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PublicTicket } from '@/lib/api/types'
import { TicketCard } from './ticket-card'
import { TICKET_DESIGNS, TICKET_HEIGHT } from './ticket-design'
import { renderTicketPng } from './ticket-image'
import { buildTicketModel } from './ticket-model'

/**
 * Kanvas tidak membaca DOM: setiap posisi vertikal di `ticket-image.ts` adalah
 * angka yang diketik ulang dengan tangan. Begitu salah satunya bergeser,
 * tiket yang diunduh supir berbeda tata letak dari yang ia lihat di layar —
 * dan itu tidak terlihat sampai PNG-nya dibuka.
 *
 * Tes ini mengambil posisi teks yang sebenarnya dari DOM (getBoundingClientRect)
 * lalu menuntut setiap baris itu punya tinta di kanvas pada ketinggian yang
 * sama. Angka kanvas yang melenceng 4 px lebih akan gagal di sini.
 */

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

const model = buildTicketModel(ticket)

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('gambar gagal dimuat'))
    image.src = src
  })
}

/**
 * Baris-baris kanvas yang berisi tinta, sebagai rentang [atas, bawah].
 *
 * Tinta diukur sebagai KONTRAS terhadap latar baris itu sendiri, bukan "gelap"
 * atau "terang". Versi pertama tes ini menandai piksel terang sebagai tinta
 * untuk kartu gelap; akibatnya badan putih desain NAVY dan BRAND dianggap
 * tinta di seluruh baris dan setiap baris DOM otomatis "lulus" — tes yang hijau
 * tanpa memeriksa apa pun. Dengan kontras terhadap latar dominan, badan putih
 * hanya bertinta di tempat hurufnya memang ada.
 */
async function inkRows(url: string) {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const rows: { start: number; end: number }[] = []
  let open: { start: number; end: number } | null = null
  const lums = new Float32Array(canvas.width)

  for (let y = 0; y < canvas.height; y += 1) {
    const bins = new Array<number>(16).fill(0)
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4
      const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114
      lums[x] = lum
      bins[Math.min(15, lum >> 4)]! += 1
    }
    // Warna yang paling banyak menempati baris ini dianggap latarnya.
    let bgBin = 0
    for (let b = 1; b < bins.length; b += 1) {
      if (bins[b]! > bins[bgBin]!) bgBin = b
    }
    const bg = bgBin * 16 + 8

    let ink = 0
    for (let x = 0; x < canvas.width; x += 1) {
      if (Math.abs(lums[x]! - bg) > 60) ink += 1
    }

    // Ambang 2 piksel per baris: menandai teks, mengabaikan tepi tipis dan
    // derau antialias.
    if (ink >= 2) {
      if (open) open.end = y
      else open = { start: y, end: y }
    } else if (open) {
      rows.push(open)
      open = null
    }
  }
  if (open) rows.push(open)
  return rows
}

/** Baris teks di DOM, relatif terhadap puncak kartu. */
function textRows(card: HTMLElement) {
  const top = card.getBoundingClientRect().top
  const nodes = card.querySelectorAll('dt, dd, p, span')
  const rows: { text: string; y: number }[] = []
  for (const node of nodes) {
    const box = node.getBoundingClientRect()
    if (box.height === 0 || !node.textContent?.trim()) continue
    rows.push({
      text: node.textContent.trim().slice(0, 24),
      y: (box.top + box.bottom) / 2 - top,
    })
  }
  return rows
}

describe('kanvas mengikuti tata letak DOM', () => {
  for (const design of TICKET_DESIGNS) {
    it(`posisi teks ${design} sejajar dengan layar`, async () => {
      const screen = await render(
        <div style={{ width: 360 }}>
          <TicketCard model={model} design={design} />
        </div>
      )
      const card = screen.container.querySelector(
        '[data-ticket-card]'
      ) as HTMLElement
      const domRows = textRows(card)
      screen.unmount()

      expect(domRows.length).toBeGreaterThan(8)

      const pngRows = await inkRows(
        await renderTicketPng(model, 1, { design })
      )
      const last = pngRows[pngRows.length - 1]!
      expect(last.end).toBeLessThanOrEqual(TICKET_HEIGHT)

      for (const row of domRows) {
        const hit = pngRows.some(
          (band) => row.y >= band.start - 3 && row.y <= band.end + 3
        )
        expect(
          hit,
          `${design}: "${row.text}" di layar y=${Math.round(row.y)} tidak bertinta di kanvas`
        ).toBe(true)
      }
    })
  }
})
