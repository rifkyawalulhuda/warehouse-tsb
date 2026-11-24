import type { TicketDesign } from '@/lib/api/types'
import type { MessageKey } from '@/lib/i18n'

/**
 * Tiga tata letak kartu tiket. Semuanya 360 x 482 dengan isi yang sama — yang
 * berbeda hanya komposisi — karena kartu yang sama muncul di layar supir,
 * hasil cetak, dan PNG 2x. Kalau salah satu desain lebih tinggi, PNG-nya harus
 * ikut berbeda dan tiket yang dikirim lewat WhatsApp tidak lagi sama dengan
 * yang dilihat di layar.
 */
export const TICKET_WIDTH = 360
export const TICKET_HEIGHT = 482

export const TICKET_DESIGNS: readonly TicketDesign[] = [
  'CLASSIC',
  'MINIMAL',
  'NAVY',
] as const

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
} as const

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
}

export const TICKET_DESIGN_LABEL: Record<TicketDesign, MessageKey> = {
  CLASSIC: 'settings.ticket.classic',
  MINIMAL: 'settings.ticket.minimal',
  NAVY: 'settings.ticket.navy',
}

export const TICKET_DESIGN_DESCRIPTION: Record<TicketDesign, MessageKey> = {
  CLASSIC: 'settings.ticket.classicHint',
  MINIMAL: 'settings.ticket.minimalHint',
  NAVY: 'settings.ticket.navyHint',
}
