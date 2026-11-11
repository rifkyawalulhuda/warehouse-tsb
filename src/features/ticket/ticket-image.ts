import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ticketFileName, type TicketModel } from './ticket-model'

/**
 * Kartu tiket diunduh sebagai PNG dengan menggambar ulang tata letak kartu di
 * kanvas, bukan dengan merekam elemen DOM. Dua alasan:
 *
 * 1. `html-to-image`/foreignObject menghasilkan berkas kosong di sebagian
 *    peramban iOS — dan tiket ini paling sering dibuka dari ponsel supir.
 * 2. Kanvas memberi ukuran pasti 2x (720 x 964 px), jadi tiket tetap tajam
 *    saat dicetak atau dikirim lewat WhatsApp.
 *
 * Angka tata letak di bawah adalah cermin dari `ticket-card.tsx`. Kalau salah
 * satu diubah, ubah pasangannya juga; `ticket-image.test.ts` menjaga isinya.
 */

const WIDTH = 360
const HEIGHT = 482
const PAD = 20
const QR_BOX = 162
const QR_TOP = 48
const SEAM_Y = 272
const TINT_Y = SEAM_Y + 1
const INSTRUCTION_Y = 296
const FIELDS_TOP = 314
const FIELD_STEP = 34
const RULE_Y = 448
const FALLBACK_Y = 466

const ACCENT = '#1d4ed8'
const INK = '#0f172a'
const MUTED = '#556579'
const TINT = '#edf1fc'
const SEAM = '#cbd5e1'

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

type TextStyle = {
  size: number
  weight?: number
  color?: string
  spacing?: number
  family?: string
}

function applyStyle(ctx: CanvasRenderingContext2D, style: TextStyle) {
  ctx.font = `${style.weight ?? 400} ${style.size}px ${style.family ?? SANS}`
  ctx.fillStyle = style.color ?? INK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

/** Lebar teks termasuk jarak antarhuruf yang kita gambar sendiri. */
function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  spacing: number
) {
  const base = ctx.measureText(text).width
  return base + spacing * Math.max(0, [...text].length - 1)
}

/**
 * `letter-spacing` kanvas belum ada di semua peramban, jadi hurufnya digambar
 * satu per satu. Dipakai untuk label kecil yang butuh renggang.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
) {
  let cursor = x
  for (const char of text) {
    ctx.fillText(char, cursor, y)
    cursor += ctx.measureText(char).width + spacing
  }
}

/** Teks panjang dipotong dengan elipsis supaya tidak menabrak kolom sebelah. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut.trimEnd()}…`
}

function centered(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: TextStyle,
  y: number
) {
  applyStyle(ctx, style)
  const spacing = style.spacing ?? 0
  const width = trackedWidth(ctx, text, spacing)
  drawTracked(ctx, text, (WIDTH - width) / 2, y, spacing)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('QR tidak bisa disiapkan'))
    image.src = src
  })
}

/**
 * QR dirender sebagai SVG lalu dirasterisasi pada ukuran target, bukan
 * diperbesar dari kanvas kecil di layar. Modul QR jadi tetap tajam di 2x.
 */
async function qrImage(qrToken: string, pixelSize: number) {
  // qrcode.react tidak menuliskan xmlns; tanpa itu `<img>` menolak SVG-nya.
  const markup = renderToStaticMarkup(
    createElement(QRCodeSVG, {
      value: qrToken,
      size: pixelSize,
      level: 'M',
      marginSize: 2,
      bgColor: '#ffffff',
      fgColor: INK,
    })
  ).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  return loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  )
}

/** `scale` 2 = 720 x 964 px, cukup untuk cetak 6 cm tanpa pecah. */
export async function renderTicketPng(model: TicketModel, scale = 2) {
  await document.fonts.ready.catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = HEIGHT * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak tersedia di peramban ini')

  ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  // Pita atas: nama gudang dan penanda jenis dokumen.
  applyStyle(ctx, { size: 10, weight: 700, color: ACCENT, spacing: 1.4 })
  drawTracked(ctx, 'WAREHOUSE TSB', PAD, 32, 1.4)
  applyStyle(ctx, { size: 10, weight: 600, color: '#94a3b8', spacing: 1.4 })
  const eTicket = 'E-TIKET'
  drawTracked(
    ctx,
    eTicket,
    WIDTH - PAD - trackedWidth(ctx, eTicket, 1.4),
    32,
    1.4
  )

  const qr = await qrImage(model.qrToken, QR_BOX * scale)
  ctx.drawImage(qr, (WIDTH - QR_BOX) / 2, QR_TOP, QR_BOX, QR_BOX)

  centered(
    ctx,
    model.code,
    {
      size: 18,
      weight: 700,
      family: MONO,
      spacing: 1.1,
    },
    234
  )

  applyStyle(ctx, { size: 10.5, color: MUTED })
  const identity = fit(
    ctx,
    `${model.customer} · ${model.warehouse}`,
    WIDTH - PAD * 2
  )
  centered(ctx, identity, { size: 10.5, color: MUTED }, 252)

  // Garis sobek: satu-satunya elemen dekoratif, pemisah dua bagian kartu.
  ctx.save()
  ctx.strokeStyle = SEAM
  ctx.lineWidth = 1
  ctx.setLineDash([7, 7])
  ctx.beginPath()
  ctx.moveTo(0, SEAM_Y + 0.5)
  ctx.lineTo(WIDTH, SEAM_Y + 0.5)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = TINT
  ctx.fillRect(0, TINT_Y, WIDTH, HEIGHT - TINT_Y)

  applyStyle(ctx, { size: 11, weight: 700, color: ACCENT })
  ctx.fillText(model.instruction, PAD, INSTRUCTION_Y)

  const columnWidth = (WIDTH - PAD * 2) / 2 - 12
  model.fields.forEach((field, index) => {
    const x = PAD + (index % 2) * ((WIDTH - PAD * 2) / 2)
    const y = FIELDS_TOP + Math.floor(index / 2) * FIELD_STEP

    applyStyle(ctx, { size: 9.5, weight: 500, color: MUTED, spacing: 0.8 })
    drawTracked(ctx, field.label.toUpperCase(), x, y, 0.8)

    applyStyle(ctx, { size: 12.5, weight: 600, color: INK })
    ctx.fillText(fit(ctx, field.value, columnWidth), x, y + 17)
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(29, 78, 216, 0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, RULE_Y + 0.5)
  ctx.lineTo(WIDTH - PAD, RULE_Y + 0.5)
  ctx.stroke()
  ctx.restore()

  applyStyle(ctx, { size: 9.5, color: MUTED })
  ctx.fillText(fit(ctx, model.fallback, WIDTH - PAD * 2), PAD, FALLBACK_Y)

  return canvas.toDataURL('image/png')
}

/**
 * `readyUrl` sudah disiapkan saat kartu tampil, jadi klik tombol berjalan
 * tanpa `await`. Safari iOS membatalkan unduhan yang dipicu setelah jeda async
 * karena gestur penggunanya sudah lewat.
 */
export async function downloadTicket(
  model: TicketModel,
  readyUrl?: string | null
) {
  const href = readyUrl ?? (await renderTicketPng(model))
  const link = document.createElement('a')
  link.href = href
  link.download = ticketFileName(model.code)
  link.rel = 'noopener'
  link.click()
}
