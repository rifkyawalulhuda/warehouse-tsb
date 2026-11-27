/**
 * Engine kuota. Fungsi murni tanpa akses database supaya bisa dites cepat
 * dan supaya satu-satunya sumber kebenaran aritmetika blok ada di satu tempat.
 *
 * Aturan (docs/prd/aturan_bisnis_logika_sistem.md):
 * - Jam operasional dibagi menjadi blok `slotUnitMinutes` (default 30).
 * - Truk menempati `blocksRequired` blok berurutan mulai dari jam kedatangan.
 * - Kuota setiap blok = jumlah dock aktif yang mengizinkan aktivitas tersebut,
 *   bukan angka manual di settings.
 */

import { minuteOfDayJakarta, minuteToLabel } from './time'

/**
 * Format jam dari menit. Satu implementasi saja: dulu fungsi ini ada di
 * `time.ts` dan di sini, dan dua salinan berarti dua tempat untuk salah.
 */
export { minuteToLabel }

export type OperatingWindow = {
  startMinute: number
  endMinute: number
  unitMinutes: number
}

/**
 * Sebab sebuah slot tidak bisa dipilih.
 *
 * KODE, bukan kalimat. Antarmuka punya dua bahasa, dan kalimat Indonesia yang
 * dikirim server muncul apa adanya di layar berbahasa Inggris. Data yang
 * dibutuhkan penerjemah (label blok yang penuh) ikut di sini supaya klien tidak
 * perlu menebak dari teks.
 */
export type SlotLimit =
  | { code: 'PAST_START' }
  | { code: 'NO_DOCK' }
  | { code: 'CLOSING_SOON' }
  | { code: 'BLOCK_FULL'; blockLabel: string }

export type SlotAvailability = {
  startMinute: number
  startLabel: string
  endMinute: number
  endLabel: string
  remaining: number
  capacity: number
  status: 'AVAILABLE' | 'FULL'
  limit: SlotLimit | null
}

export type BlockUsage = ReadonlyMap<number, number>

export class SlotRangeError extends Error {
  constructor(
    public readonly code:
      | 'SLOT_NOT_ALIGNED'
      | 'SLOT_BEFORE_OPENING'
      | 'SLOT_AFTER_CLOSING'
      | 'SLOT_OVERFLOW',
    message: string
  ) {
    super(message)
    this.name = 'SlotRangeError'
  }
}

/** Semua jam mulai yang mungkin, yaitu blok yang masih utuh di dalam jam operasional. */
export function listBlockStarts(window: OperatingWindow): number[] {
  const starts: number[] = []
  for (
    let minute = window.startMinute;
    minute + window.unitMinutes <= window.endMinute;
    minute += window.unitMinutes
  ) {
    starts.push(minute)
  }
  return starts
}

/**
 * Blok grid yang ditempati satu rentang waktu.
 *
 * Dipakai saat pengaturan jam buka atau satuan blok berubah setelah booking
 * dibuat. Blok tersimpan (`bookings.block_starts`) memakai grid lama, sedangkan
 * baris `slot_allocations` disusun ulang di grid baru. Menghitung dari jam
 * nyata booking — bukan dari snapshot lama — membuat penempatan dan pelepasan
 * kuota sepakat tanpa bergantung pada pengaturan yang berlaku saat booking
 * dibuat.
 *
 * Blok dianggap terpakai bila irisannya dengan rentang tidak kosong, sehingga
 * booking lama yang jamnya tidak sejajar grid baru tetap menempati blok yang
 * benar dan kuota tidak dilepas ke truk lain.
 */
export function blocksCoveredBy(
  window: OperatingWindow,
  startTime: Date,
  endTime: Date
): number[] {
  const spanMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  if (!Number.isFinite(spanMinutes) || spanMinutes <= 0) return []
  const startMinute = minuteOfDayJakarta(startTime)
  const endMinute = startMinute + spanMinutes
  return listBlockStarts(window).filter(
    (block) => block < endMinute && block + window.unitMinutes > startMinute
  )
}

/**
 * Blok yang ditempati satu truk. Melempar SlotRangeError bila jam tidak sejajar,
 * di luar jam operasional, atau durasinya melewati jam tutup.
 */
export function requiredBlocks(
  window: OperatingWindow,
  startMinute: number,
  blocksRequired: number
): number[] {
  if (!Number.isInteger(blocksRequired) || blocksRequired < 1) {
    throw new SlotRangeError('SLOT_NOT_ALIGNED', 'Jumlah blok truk tidak valid')
  }
  if ((startMinute - window.startMinute) % window.unitMinutes !== 0) {
    throw new SlotRangeError('SLOT_NOT_ALIGNED', 'Jam mulai harus kelipatan satuan blok')
  }
  if (startMinute < window.startMinute) {
    throw new SlotRangeError('SLOT_BEFORE_OPENING', 'Jam mulai sebelum jam operasional')
  }
  const endMinute = startMinute + blocksRequired * window.unitMinutes
  if (endMinute > window.endMinute) {
    throw new SlotRangeError(
      'SLOT_OVERFLOW',
      'Durasi armada melewati jam tutup operasional'
    )
  }
  return Array.from({ length: blocksRequired }, (_, i) => startMinute + i * window.unitMinutes)
}

/** Sisa kuota satu slot = minimum sisa di seluruh blok yang ditempatinya. */
export function remainingForBlocks(
  blocks: readonly number[],
  capacity: number,
  usedByBlock: BlockUsage
): number {
  let remaining = capacity
  for (const block of blocks) {
    const used = usedByBlock.get(block) ?? 0
    remaining = Math.min(remaining, capacity - used)
  }
  return Math.max(0, remaining)
}

/**
 * Daftar jam yang bisa dipilih Customer untuk satu jenis truk.
 * Hanya jam mulai yang memungkinkan durasi penuh yang ditandai AVAILABLE.
 */
export function computeAvailability(opts: {
  window: OperatingWindow
  blocksRequired: number
  capacity: number
  usedByBlock: BlockUsage
}): SlotAvailability[] {
  const { window, blocksRequired, capacity, usedByBlock } = opts
  const slots: SlotAvailability[] = []

  for (const startMinute of listBlockStarts(window)) {
    const endMinute = startMinute + blocksRequired * window.unitMinutes
    const base = {
      startMinute,
      startLabel: minuteToLabel(startMinute),
      endMinute,
      endLabel: minuteToLabel(endMinute),
      capacity,
    }

    if (endMinute > window.endMinute) {
      slots.push({
        ...base,
        endLabel: minuteToLabel(window.endMinute),
        remaining: 0,
        status: 'FULL',
        limit: { code: 'CLOSING_SOON' },
      })
      continue
    }

    const blocks = requiredBlocks(window, startMinute, blocksRequired)
    let limitingBlock: number | null = null
    let remaining = capacity
    for (const block of blocks) {
      const blockRemaining = capacity - (usedByBlock.get(block) ?? 0)
      if (blockRemaining < remaining) {
        remaining = blockRemaining
        limitingBlock = block
      }
    }

    if (remaining <= 0) {
      slots.push({
        ...base,
        remaining: 0,
        status: 'FULL',
        limit:
          capacity <= 0
            ? { code: 'NO_DOCK' }
            : {
                code: 'BLOCK_FULL',
                blockLabel: minuteToLabel(limitingBlock ?? startMinute),
              },
      })
      continue
    }

    slots.push({ ...base, remaining, status: 'AVAILABLE', limit: null })
  }

  return slots
}

/** Jumlah blok per hari operasional, dipakai saat menyiapkan baris kuota. */
export function totalBlocksPerDay(window: OperatingWindow): number {
  return listBlockStarts(window).length
}
