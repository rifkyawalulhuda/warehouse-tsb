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

export type OperatingWindow = {
  startMinute: number
  endMinute: number
  unitMinutes: number
}

export type SlotAvailability = {
  startMinute: number
  startLabel: string
  endMinute: number
  endLabel: string
  remaining: number
  capacity: number
  status: 'AVAILABLE' | 'FULL'
  limitReason: string | null
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

export function minuteToLabel(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
        limitReason: 'Tidak cukup waktu sebelum jam tutup',
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
        limitReason:
          capacity <= 0
            ? 'Tidak ada dock aktif untuk aktivitas ini'
            : `Kuota blok ${minuteToLabel(limitingBlock ?? startMinute)} habis`,
      })
      continue
    }

    slots.push({ ...base, remaining, status: 'AVAILABLE', limitReason: null })
  }

  return slots
}

/** Jumlah blok per hari operasional, dipakai saat menyiapkan baris kuota. */
export function totalBlocksPerDay(window: OperatingWindow): number {
  return listBlockStarts(window).length
}
