import { createElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TicketDesign } from '@/lib/api/types'
import { getLocale, translate } from '@/lib/i18n'
import {
  DEFAULT_TICKET_DESIGN,
  TICKET_HEIGHT,
  TICKET_PALETTE as P,
  TICKET_WIDTH,
} from './ticket-design'
import {
  splitTicketDate,
  ticketFileName,
  type TicketField,
  type TicketModel,
} from './ticket-model'

/**
 * Kartu tiket diunduh sebagai PNG dengan menggambar ulang tata letak kartu di
 * kanvas, bukan dengan merekam elemen DOM. Dua alasan:
 *
 * 1. `html-to-image`/foreignObject menghasilkan berkas kosong di sebagian
 *    peramban iOS — dan tiket ini paling sering dibuka dari ponsel supir.
 * 2. Kanvas memberi ukuran pasti 2x (720 x 964 px), jadi tiket tetap tajam
 *    saat dicetak atau dikirim lewat WhatsApp.
 *
 * Angka tata letak di bawah adalah cermin dari `ticket-card.tsx` untuk ketiga
 * desain. Kalau salah satu diubah, ubah pasangannya juga; `ticket-image.test.ts`
 * menjaga ukuran dan isinya.
 */

const WIDTH = TICKET_WIDTH
const HEIGHT = TICKET_HEIGHT
const PAD = 20
const LOGO = 16
/** Jarak teks merek dari tepi kiri saat logo ikut digambar. */
const LOGO_GAP = 4

const ACCENT = P.accent
const ACCENT_SOFT = P.accentSoft
const INK = P.ink
const MUTED = P.muted
const BADGE = P.badge
const TINT = P.tint
const SEAM = P.seam
const LINE = P.line
const NAVY = P.navy
const NAVY_INK = P.navyInk
const NAVY_MUTED = P.navyMuted
const NAVY_BADGE = P.navyBadge
const WHITE = P.white

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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new Error(translate(getLocale(), 'ticket.imageQrError')))
    image.src = src
  })
}

/**
 * Logo hanya digambar bila bisa dimuat dengan CORS anonim. Tanpa itu, gambar
 * dari domain lain akan menodai kanvas dan `toDataURL` melempar galat — tiket
 * yang sudah tampil di layar lalu gagal diunduh. Gagal memuat = tiket tetap
 * dirender dengan nama aplikasi saja, bukan gagal total.
 */
async function logoImage(url: string | null | undefined) {
  const src = url?.trim()
  if (!src) return null
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
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
      bgColor: WHITE,
      fgColor: INK,
    })
  ).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  return loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  )
}

/**
 * Pita atas ketiga desain: nama merek (dengan logo bila ada) di kiri, jenis
 * dokumen di kanan. `baseline` adalah garis dasar teks 10 px.
 */
function brandRow(
  ctx: CanvasRenderingContext2D,
  model: TicketModel,
  logo: HTMLImageElement | null,
  options: {
    baseline: number
    brandColor: string
    badgeColor: string
    logoBox?: string
  }
) {
  const badge = model.badge.toUpperCase()
  applyStyle(ctx, {
    size: 10,
    weight: 600,
    color: options.badgeColor,
    spacing: 1.4,
  })
  const badgeWidth = trackedWidth(ctx, badge, 1.4)

  let x = PAD
  if (logo) {
    const top = options.baseline - 12
    if (options.logoBox) {
      ctx.fillStyle = options.logoBox
      roundRect(ctx, x, top, LOGO + 4, LOGO + 4, 3)
      ctx.fill()
      ctx.drawImage(logo, x + 2, top + 2, LOGO, LOGO)
    } else {
      ctx.drawImage(logo, x, top, LOGO, LOGO)
    }
    x += LOGO + LOGO_GAP + 4
  }

  applyStyle(ctx, {
    size: 10,
    weight: 700,
    color: options.brandColor,
    spacing: 1.4,
  })
  drawTracked(
    ctx,
    fit(ctx, model.appName.toUpperCase(), WIDTH - PAD - badgeWidth - 12 - x),
    x,
    options.baseline,
    1.4
  )

  applyStyle(ctx, {
    size: 10,
    weight: 600,
    color: options.badgeColor,
    spacing: 1.4,
  })
  drawTracked(ctx, badge, WIDTH - PAD - badgeWidth, options.baseline, 1.4)
}

/** Grid dua kolom berisi label kecil dan nilainya. */
function fieldGrid(
  ctx: CanvasRenderingContext2D,
  fields: TicketField[],
  options: { top: number; step: number; valueOffset: number; from?: number }
) {
  const columnWidth = (WIDTH - PAD * 2) / 2 - 12
  const from = options.from ?? 0
  fields.slice(from).forEach((field, index) => {
    const x = PAD + (index % 2) * ((WIDTH - PAD * 2) / 2)
    const y = options.top + Math.floor(index / 2) * options.step

    applyStyle(ctx, { size: 9.5, weight: 500, color: MUTED, spacing: 0.8 })
    drawTracked(ctx, field.label.toUpperCase(), x, y, 0.8)

    applyStyle(ctx, { size: 12.5, weight: 600, color: INK })
    ctx.fillText(fit(ctx, field.value, columnWidth), x, y + options.valueOffset)
  })
}

function dashedRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  color: string = SEAM,
  dash: [number, number] = [7, 7]
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(0, y + 0.5)
  ctx.lineTo(WIDTH, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

function solidRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  from: number,
  to: number,
  color: string
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(from, y + 0.5)
  ctx.lineTo(to, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

/* ------------------------------ Klasik Biru ------------------------------ */

function drawClassic(
  ctx: CanvasRenderingContext2D,
  model: TicketModel,
  qr: HTMLImageElement,
  logo: HTMLImageElement | null
) {
  const QR_BOX = 162
  const QR_TOP = 48
  const SEAM_Y = 272
  const INSTRUCTION_Y = 296
  const FIELDS_TOP = 314
  const RULE_Y = 448
  const FALLBACK_Y = 466

  brandRow(ctx, model, logo, {
    baseline: 32,
    brandColor: ACCENT,
    badgeColor: BADGE,
  })

  ctx.drawImage(qr, (WIDTH - QR_BOX) / 2, QR_TOP, QR_BOX, QR_BOX)

  centered(
    ctx,
    model.code,
    { size: 18, weight: 700, family: MONO, spacing: 1.1 },
    234
  )

  applyStyle(ctx, { size: 10.5, color: MUTED })
  centered(
    ctx,
    fit(ctx, `${model.customer} · ${model.warehouse}`, WIDTH - PAD * 2),
    { size: 10.5, color: MUTED },
    252
  )

  // Garis sobek: satu-satunya elemen dekoratif, pemisah dua bagian kartu.
  dashedRule(ctx, SEAM_Y)

  ctx.fillStyle = TINT
  ctx.fillRect(0, SEAM_Y + 1, WIDTH, HEIGHT - SEAM_Y - 1)

  applyStyle(ctx, { size: 11, weight: 700, color: ACCENT })
  ctx.fillText(model.instruction, PAD, INSTRUCTION_Y)

  fieldGrid(ctx, model.fields, {
    top: FIELDS_TOP,
    step: 34,
    valueOffset: 17,
  })

  solidRule(ctx, RULE_Y, PAD, WIDTH - PAD, ACCENT_SOFT)

  applyStyle(ctx, { size: 9.5, color: MUTED })
  ctx.fillText(fit(ctx, model.fallback, WIDTH - PAD * 2), PAD, FALLBACK_Y)
}

/* ----------------------------- Minimal Putih ----------------------------- */

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  model: TicketModel,
  qr: HTMLImageElement,
  logo: HTMLImageElement | null
) {
  const QR_BOX = 132
  const QR_TOP = 48
  const SIDE_X = PAD + QR_BOX + 16

  // Batang aksen di tepi atas: satu-satunya warna di kartu yang serba putih.
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, WIDTH, 4)

  brandRow(ctx, model, logo, {
    baseline: 34,
    brandColor: INK,
    badgeColor: MUTED,
  })

  ctx.drawImage(qr, PAD, QR_TOP, QR_BOX, QR_BOX)

  const { day, date } = splitTicketDate(model.date)
  const sideWidth = WIDTH - PAD - SIDE_X

  if (day) {
    applyStyle(ctx, { size: 10, weight: 600, color: MUTED, spacing: 1 })
    drawTracked(ctx, day.toUpperCase(), SIDE_X, 56, 1)
  }

  applyStyle(ctx, { size: 24, weight: 700, color: INK })
  ctx.fillText(fit(ctx, date, sideWidth), SIDE_X, 84)

  applyStyle(ctx, { size: 13, weight: 600, color: ACCENT })
  ctx.fillText(fit(ctx, model.schedule, sideWidth), SIDE_X, 104)

  applyStyle(ctx, { size: 11.5, weight: 700, color: MUTED, family: MONO })
  ctx.fillText(fit(ctx, model.code, sideWidth), SIDE_X, 120)

  // Titik aksen menggantikan warna teks: instruksi tetap hitam agar terbaca,
  // sementara penanda biru memberi tahu bahwa ini baris penting.
  ctx.fillStyle = ACCENT
  ctx.beginPath()
  ctx.arc(PAD + 2.5, 206, 2.5, 0, Math.PI * 2)
  ctx.fill()

  applyStyle(ctx, { size: 11, weight: 600, color: INK })
  ctx.fillText(fit(ctx, model.instruction, WIDTH - PAD * 2 - 8), PAD + 8, 210)

  // Tanggal dan jam sudah jadi sorotan di atas, jadi enam nilai sisanya.
  fieldGrid(ctx, model.fields, {
    top: 253,
    step: 34,
    valueOffset: 16,
    from: 2,
  })

  dashedRule(ctx, 361, LINE, [4, 4])

  applyStyle(ctx, { size: 11.5, weight: 600, color: INK })
  ctx.fillText(fit(ctx, model.customer, WIDTH - PAD * 2), PAD, 383)

  applyStyle(ctx, { size: 10.5, color: MUTED })
  ctx.fillText(fit(ctx, model.warehouse, WIDTH - PAD * 2), PAD, 399)

  solidRule(ctx, 438, PAD, WIDTH - PAD, LINE)

  applyStyle(ctx, { size: 9.5, color: MUTED })
  ctx.fillText(fit(ctx, model.fallback, WIDTH - PAD * 2), PAD, 456)
}

/* ------------------------------ Navy Resmi ------------------------------ */

function drawNavy(
  ctx: CanvasRenderingContext2D,
  model: TicketModel,
  qr: HTMLImageElement,
  logo: HTMLImageElement | null
) {
  const HEAD_BOTTOM = 146
  const CARD_SIZE = 166
  const QR_BOX = 150
  const CARD_X = (WIDTH - CARD_SIZE) / 2
  // Kartu menumpuk 42 px ke pita navy. Lebih dalam dari itu, bayangannya naik
  // menutupi baris customer di atasnya.
  const CARD_Y = 104

  ctx.fillStyle = NAVY
  ctx.fillRect(0, 0, WIDTH, HEAD_BOTTOM)

  brandRow(ctx, model, logo, {
    baseline: 34,
    brandColor: NAVY_INK,
    badgeColor: NAVY_BADGE,
    // Logo gelap akan tenggelam di pita navy.
    logoBox: WHITE,
  })

  applyStyle(ctx, {
    size: 24,
    weight: 700,
    color: NAVY_INK,
    family: MONO,
    spacing: 0.8,
  })
  ctx.fillText(fit(ctx, model.code, WIDTH - PAD * 2), PAD, 66)

  applyStyle(ctx, { size: 10.5, color: NAVY_MUTED })
  ctx.fillText(
    fit(ctx, `${model.customer} · ${model.warehouse}`, WIDTH - PAD * 2),
    PAD,
    88
  )

  // Kartu putih QR menumpuk ke pita navy — satu-satunya elemen yang keluar dari
  // kolomnya, dan sengaja: itu yang membuatnya terbaca sebagai pass.
  ctx.save()
  ctx.shadowColor = P.shadow
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 4
  ctx.fillStyle = WHITE
  roundRect(ctx, CARD_X, CARD_Y, CARD_SIZE, CARD_SIZE, 12)
  ctx.fill()
  ctx.restore()

  ctx.drawImage(qr, CARD_X + 8, CARD_Y + 8, QR_BOX, QR_BOX)

  applyStyle(ctx, { size: 11, weight: 700, color: NAVY })
  ctx.fillText(model.instruction, PAD, 292)

  fieldGrid(ctx, model.fields, {
    top: 310,
    step: 34,
    valueOffset: 16,
  })

  solidRule(ctx, 448, PAD, WIDTH - PAD, ACCENT_SOFT)

  applyStyle(ctx, { size: 9.5, color: MUTED })
  ctx.fillText(fit(ctx, model.fallback, WIDTH - PAD * 2), PAD, 466)
}

/* -------------------------------- masuk -------------------------------- */

export type RenderTicketOptions = {
  design?: TicketDesign
  /** Logo aplikasi; dimuat dengan CORS anonim, dilewati bila gagal. */
  logoUrl?: string | null
}

/** `scale` 2 = 720 x 964 px, cukup untuk cetak 6 cm tanpa pecah. */
export async function renderTicketPng(
  model: TicketModel,
  scale = 2,
  options: RenderTicketOptions = {}
) {
  await document.fonts.ready.catch(() => undefined)

  const design = options.design ?? DEFAULT_TICKET_DESIGN
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = HEIGHT * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(translate(getLocale(), 'ticket.imageCanvasError'))

  ctx.scale(scale, scale)

  ctx.fillStyle = WHITE
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const [qr, logo] = await Promise.all([
    qrImage(model.qrToken, 162 * scale),
    logoImage(options.logoUrl),
  ])

  if (design === 'MINIMAL') drawMinimal(ctx, model, qr, logo)
  else if (design === 'NAVY') drawNavy(ctx, model, qr, logo)
  else drawClassic(ctx, model, qr, logo)

  return canvas.toDataURL('image/png')
}

/**
 * `readyUrl` sudah disiapkan saat kartu tampil, jadi klik tombol berjalan
 * tanpa `await`. Safari iOS membatalkan unduhan yang dipicu setelah jeda async
 * karena gestur penggunanya sudah lewat.
 */
export async function downloadTicket(
  model: TicketModel,
  readyUrl?: string | null,
  options: RenderTicketOptions = {}
) {
  const href = readyUrl ?? (await renderTicketPng(model, 2, options))
  const link = document.createElement('a')
  link.href = href
  link.download = ticketFileName(model.code)
  link.rel = 'noopener'
  link.click()
}
