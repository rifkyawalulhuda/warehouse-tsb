import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PublicTicket } from '@/lib/api/types'
import { downloadTicket, renderTicketPng } from './ticket-image'
import { buildTicketModel, ticketFileName } from './ticket-model'

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

const model = buildTicketModel(ticket)

function decode(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('PNG tidak bisa dibaca'))
    image.src = url
  })
}

/** Hitung piksel gelap dan piksel biru sebagai bukti kartunya benar-benar tergambar. */
function inspect(url: string) {
  return decode(url).then((image) => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let dark = 0
    let blue = 0
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!]
      if (r < 80 && g < 80 && b < 80) dark += 1
      if (b > r + 40 && b > 120) blue += 1
    }

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      dark,
      blue,
    }
  })
}

describe('gambar tiket', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('menggambar kartu 2x, bukan sekadar QR kecil', async () => {
    const url = await renderTicketPng(model)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)

    const image = await inspect(url)
    expect(image.width).toBe(720)
    expect(image.height).toBe(964)
    // Modul QR dan teks menyisakan ribuan piksel gelap.
    expect(image.dark).toBeGreaterThan(5000)
    // Warna aksen #1d4ed8 muncul di pita atas dan baris instruksi.
    expect(image.blue).toBeGreaterThan(200)
  })

  it('memakai ukuran 1x saat diminta untuk pratinjau', async () => {
    const image = await inspect(await renderTicketPng(model, 1))
    expect(image.width).toBe(360)
    expect(image.height).toBe(482)
  })

  it('mengunduh dengan nama berkas berisi kode booking', async () => {
    const anchors: HTMLAnchorElement[] = []
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        anchors.push(this)
      })

    await downloadTicket(model, 'data:image/png;base64,TEST')

    expect(click).toHaveBeenCalledOnce()
    expect(anchors[0]?.download).toBe('tiket-TSB-20261111-003.png')
    expect(anchors[0]?.href).toBe('data:image/png;base64,TEST')
  })

  it('menyiapkan PNG sendiri bila belum siap saat diklik', async () => {
    const anchors: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      anchors.push(this)
    })

    await downloadTicket(model)

    expect(anchors[0]?.href.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('menamai berkas dari kode booking', () => {
    expect(ticketFileName('TSB-20261111-003')).toBe(
      'tiket-TSB-20261111-003.png'
    )
  })
})
