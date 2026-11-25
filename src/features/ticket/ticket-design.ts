import type { TicketDesign } from '@/lib/api/types'
import type { MessageKey } from '@/lib/i18n'

/**
 * Delapan tata letak kartu tiket. Semuanya 360 x 482 dengan isi yang sama — yang
 * berbeda hanya komposisi — karena kartu yang sama muncul di layar supir,
 * hasil cetak, dan PNG 2x. Kalau salah satu desain lebih tinggi, PNG-nya harus
 * ikut berbeda dan tiket yang dikirim lewat WhatsApp tidak lagi sama dengan
 * yang dilihat di layar.
 *
 * Tiga yang pertama adalah tampilan standar. Lima sisanya menutup kondisi yang
 * tidak dilayani ketiganya: cetak thermal/fotokopi pudar (TERMAL), petugas yang
 * harus mengetik kode karena QR gagal (KODE_BESAR), dibuka di gerbang malam
 * (MALAM), tiket yang disobek petugas (PITA), dan identitas gudang (MEREK).
 */
export const TICKET_WIDTH = 360
export const TICKET_HEIGHT = 482

export const TICKET_DESIGNS: readonly TicketDesign[] = [
  'CLASSIC',
  'MINIMAL',
  'NAVY',
  'THERMAL',
  'LARGE_CODE',
  'NIGHT',
  'TEAROFF',
  'BRAND',
] as const

/** Dikelompokkan di pemilih Pengaturan supaya delapan pilihan tidak jadi satu dinding. */
export const TICKET_DESIGN_GROUP: Record<
  TicketDesign,
  'standard' | 'special'
> = {
  CLASSIC: 'standard',
  MINIMAL: 'standard',
  NAVY: 'standard',
  THERMAL: 'special',
  LARGE_CODE: 'special',
  NIGHT: 'special',
  TEAROFF: 'special',
  BRAND: 'special',
}

/** Desain bawaan: tata letak yang dipakai sebelum pilihan ini ada. */
export const DEFAULT_TICKET_DESIGN: TicketDesign = 'CLASSIC'

export function isTicketDesign(value: unknown): value is TicketDesign {
  return (
    typeof value === 'string' &&
    (TICKET_DESIGNS as readonly string[]).includes(value)
  )
}

/**
 * Warna desain dikumpulkan di sini, bukan ditulis ulang di komponen DOM dan di
 * kanvas: dua salinan hex yang berbeda satu digit menghasilkan tiket yang
 * berubah warna setelah diunduh.
 */
export const TICKET_PALETTE = {
  accent: '#1d4ed8',
  /** Garis pemisah di atas latar tint; sama dengan `border-accent/20`. */
  accentSoft: 'rgba(29, 78, 216, 0.2)',
  ink: '#0f172a',
  muted: '#556579',
  /** Label kecil di atas putih; #94a3b8 hanya 2,6:1, di bawah ambang 4,5:1. */
  badge: '#64748b',
  seam: '#cbd5e1',
  tint: '#edf1fc',
  line: '#e2e8f0',
  navy: '#1f3a5f',
  navyInk: '#ffffff',
  navyMuted: '#c7d3e3',
  navyBadge: '#a9b8cc',
  white: '#ffffff',
  /** Bayangan kartu QR yang menumpuk ke pita navy (Navy Resmi). */
  shadow: 'rgba(15, 23, 42, 0.2)',

  /* Termal Mono: tanpa warna sama sekali. Hierarki hanya dari ketebalan huruf,
     karena printer thermal dan fotokopi pudar mengubah semua abu-abu menjadi
     bintik. */
  monoInk: '#000000',
  monoMuted: '#3f3f3f',

  /* Malam: kartu gelap untuk gerbang malam. QR tetap di alas putih — QR terbalik
     gagal di sebagian pemindai, jadi latarnya tidak boleh ikut gelap. */
  night: '#0f172a',
  nightInk: '#f8fafc',
  nightMuted: '#94a3b8',
  nightAccent: '#93c5fd',
  nightLine: 'rgba(248, 250, 252, 0.18)',
  nightSoft: 'rgba(248, 250, 252, 0.12)',

  /** Stub Pita Sobek: netral, bukan tint biru, supaya sobekan tetap terbaca. */
  stub: '#f1f5f9',
} as const

/* --------------------------- penjaga kontras ---------------------------- */

function hexChannels(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function channelLuminance(channel: number) {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Rasio kontras WCAG 2.1; hex 3/6 digit yang tidak sah menghasilkan 1. */
export function contrastRatio(a: string, b: string): number {
  const left = hexChannels(a)
  const right = hexChannels(b)
  if (!left || !right) return 1
  const la =
    0.2126 * channelLuminance(left[0]) +
    0.7152 * channelLuminance(left[1]) +
    0.0722 * channelLuminance(left[2])
  const lb =
    0.2126 * channelLuminance(right[0]) +
    0.7152 * channelLuminance(right[1]) +
    0.0722 * channelLuminance(right[2])
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function toHex(channels: [number, number, number]) {
  return `#${channels
    .map((c) => Math.round(c).toString(16).padStart(2, '0'))
    .join('')}`
}

/** Warna teks yang tetap terbaca di atas latar bebas pilihan Admin. */
export function readableOn(background: string): string {
  return contrastRatio(background, TICKET_PALETTE.ink) >=
    contrastRatio(background, TICKET_PALETTE.white)
    ? TICKET_PALETTE.ink
    : TICKET_PALETTE.white
}

/**
 * Warna merek yang dipakai sebagai teks di atas putih. Warna terang seperti
 * kuning hanya 1,3:1 di atas putih, jadi nilainya digelapkan bertahap sampai
 * lolos 4,5:1. Tanpa ini, "Warna Merek" menghasilkan instruksi yang tak terbaca
 * justru pada merek yang paling mencolok.
 */
export function accentOnWhite(color: string, minimum = 4.5): string {
  const channels = hexChannels(color)
  if (!channels) return TICKET_PALETTE.accent
  let current = channels
  for (let step = 0; step < 20; step += 1) {
    const hex = toHex(current)
    if (contrastRatio(hex, TICKET_PALETTE.white) >= minimum) return hex
    current = [current[0] * 0.88, current[1] * 0.88, current[2] * 0.88]
  }
  return TICKET_PALETTE.ink
}

/**
 * Warna pita desain MEREK. Kosong atau bukan hex berarti warna aksen bawaan,
 * sehingga gudang yang belum pernah mengisi warna merek tetap mendapat tiket
 * yang sah — bukan pita putih dengan teks putih.
 */
export function ticketBandColor(brandColor: string | null | undefined): string {
  const value = brandColor?.trim()
  return value && hexChannels(value) ? value.toLowerCase() : TICKET_PALETTE.accent
}

/** Teks sekunder di dalam pita: turunan dari teks utama, bukan abu-abu tetap. */
export function bandMutedInk(band: string): string {
  return readableOn(band) === TICKET_PALETTE.white
    ? 'rgba(255, 255, 255, 0.78)'
    : 'rgba(15, 23, 42, 0.7)'
}

/**
 * Palet di atas dipasang sebagai custom property pada elemen kartu, lalu kelas
 * Tailwind memakainya lewat `var(--tk-*)`. Dengan begitu hex warna hanya hidup
 * di satu berkas, dan kanvas (`ticket-image.ts`) membaca sumber yang sama.
 */
export const TICKET_CSS_VARS: Record<string, string> = {
  '--tk-accent': TICKET_PALETTE.accent,
  '--tk-accent-soft': TICKET_PALETTE.accentSoft,
  '--tk-ink': TICKET_PALETTE.ink,
  '--tk-muted': TICKET_PALETTE.muted,
  '--tk-badge': TICKET_PALETTE.badge,
  '--tk-seam': TICKET_PALETTE.seam,
  '--tk-tint': TICKET_PALETTE.tint,
  '--tk-line': TICKET_PALETTE.line,
  '--tk-navy': TICKET_PALETTE.navy,
  '--tk-navy-muted': TICKET_PALETTE.navyMuted,
  '--tk-navy-badge': TICKET_PALETTE.navyBadge,
  '--tk-shadow': TICKET_PALETTE.shadow,
  '--tk-mono-ink': TICKET_PALETTE.monoInk,
  '--tk-mono-muted': TICKET_PALETTE.monoMuted,
  '--tk-night': TICKET_PALETTE.night,
  '--tk-night-ink': TICKET_PALETTE.nightInk,
  '--tk-night-muted': TICKET_PALETTE.nightMuted,
  '--tk-night-accent': TICKET_PALETTE.nightAccent,
  '--tk-night-line': TICKET_PALETTE.nightLine,
  '--tk-night-soft': TICKET_PALETTE.nightSoft,
  '--tk-stub': TICKET_PALETTE.stub,
  '--tk-band': TICKET_PALETTE.accent,
  '--tk-band-ink': TICKET_PALETTE.white,
  '--tk-band-muted': 'rgba(255, 255, 255, 0.78)',
}

/** Varian variabel untuk desain yang warnanya bergantung pada isian Admin. */
export function ticketCssVars(
  design: TicketDesign,
  brandColor?: string | null
): Record<string, string> {
  if (design !== 'BRAND') return TICKET_CSS_VARS
  const band = ticketBandColor(brandColor)
  return {
    ...TICKET_CSS_VARS,
    '--tk-band': band,
    '--tk-band-ink': readableOn(band),
    '--tk-band-muted': bandMutedInk(band),
    '--tk-accent': accentOnWhite(band),
  }
}

export const TICKET_DESIGN_LABEL: Record<TicketDesign, MessageKey> = {
  CLASSIC: 'settings.ticket.classic',
  MINIMAL: 'settings.ticket.minimal',
  NAVY: 'settings.ticket.navy',
  THERMAL: 'settings.ticket.thermal',
  LARGE_CODE: 'settings.ticket.largeCode',
  NIGHT: 'settings.ticket.night',
  TEAROFF: 'settings.ticket.tearoff',
  BRAND: 'settings.ticket.brand',
}

export const TICKET_DESIGN_DESCRIPTION: Record<TicketDesign, MessageKey> = {
  CLASSIC: 'settings.ticket.classicHint',
  MINIMAL: 'settings.ticket.minimalHint',
  NAVY: 'settings.ticket.navyHint',
  THERMAL: 'settings.ticket.thermalHint',
  LARGE_CODE: 'settings.ticket.largeCodeHint',
  NIGHT: 'settings.ticket.nightHint',
  TEAROFF: 'settings.ticket.tearoffHint',
  BRAND: 'settings.ticket.brandHint',
}
