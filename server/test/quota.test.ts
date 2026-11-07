import { describe, expect, it } from 'vitest'
import {
  computeAvailability,
  listBlockStarts,
  minuteToLabel,
  remainingForBlocks,
  requiredBlocks,
  SlotRangeError,
  totalBlocksPerDay,
} from '../src/lib/quota'

/** Jam operasional default PRD: 08:00-17:00, blok 30 menit. */
const window = { startMinute: 8 * 60, endMinute: 17 * 60, unitMinutes: 30 }

describe('listBlockStarts', () => {
  it('membuat blok utuh dari buka sampai tutup', () => {
    const starts = listBlockStarts(window)
    expect(starts[0]).toBe(480) // 08:00
    expect(starts.at(-1)).toBe(990) // 16:30, karena 17:00 tidak menyisakan blok penuh
    expect(starts).toHaveLength(18)
    expect(totalBlocksPerDay(window)).toBe(18)
  })

  it('tidak menghasilkan blok bila jam operasional lebih pendek dari satu blok', () => {
    expect(listBlockStarts({ startMinute: 480, endMinute: 490, unitMinutes: 30 })).toEqual([])
  })
})

describe('requiredBlocks', () => {
  it('menutup blok berurutan sesuai durasi truk', () => {
    expect(requiredBlocks(window, 9 * 60, 2)).toEqual([540, 570])
    expect(requiredBlocks(window, 8 * 60, 4)).toEqual([480, 510, 540, 570])
  })

  it('menolak jam yang tidak sejajar satuan blok', () => {
    expect(() => requiredBlocks(window, 9 * 60 + 15, 2)).toThrow(SlotRangeError)
  })

  it('menolak jam sebelum gudang buka', () => {
    expect(() => requiredBlocks(window, 7 * 60 + 30, 2)).toThrow(/sebelum jam operasional/)
  })

  it('menolak durasi yang melewati jam tutup', () => {
    // 16:30 + 2 blok = 17:30, lewat jam tutup.
    expect(() => requiredBlocks(window, 990, 2)).toThrow(/melewati jam tutup/)
  })

  it('menerima durasi yang berakhir tepat di jam tutup', () => {
    expect(requiredBlocks(window, 960, 2)).toEqual([960, 990])
  })
})

describe('remainingForBlocks', () => {
  it('memakai sisa terkecil dari seluruh blok yang ditempati', () => {
    const used = new Map([
      [540, 1],
      [570, 3],
    ])
    expect(remainingForBlocks([540, 570], 4, used)).toBe(1)
  })

  it('tidak pernah negatif walau data pemakaian melebihi kapasitas', () => {
    expect(remainingForBlocks([540], 2, new Map([[540, 5]]))).toBe(0)
  })
})

describe('computeAvailability', () => {
  it('menandai semua slot tersedia saat belum ada pemakaian', () => {
    const slots = computeAvailability({
      window,
      blocksRequired: 2,
      capacity: 4,
      usedByBlock: new Map(),
    })

    const available = slots.filter((slot) => slot.status === 'AVAILABLE')
    // 18 blok mulai, tetapi blok terakhir tidak cukup untuk durasi 2 blok.
    expect(available).toHaveLength(17)
    expect(available[0]?.startLabel).toBe('08:00')
    expect(available[0]?.endLabel).toBe('09:00')
  })

  it('menolak jam mulai yang blok tengahnya sudah penuh', () => {
    // Kapasitas 1, blok 09:30 penuh. Booking 09:00-10:00 (2 blok) harus gagal
    // walau 09:00 sendiri masih kosong.
    const slots = computeAvailability({
      window,
      blocksRequired: 2,
      capacity: 1,
      usedByBlock: new Map([[570, 1]]),
    })

    const nineAm = slots.find((slot) => slot.startMinute === 540)
    expect(nineAm?.status).toBe('FULL')
    expect(nineAm?.remaining).toBe(0)
    expect(nineAm?.limitReason).toContain('09:30')

    // 10:00 tetap bisa karena tidak menyentuh blok 09:30.
    expect(slots.find((slot) => slot.startMinute === 600)?.status).toBe('AVAILABLE')
  })

  it('menampilkan sisa kuota terkecil sebagai angka slot', () => {
    const slots = computeAvailability({
      window,
      blocksRequired: 3,
      capacity: 4,
      usedByBlock: new Map([
        [480, 1],
        [510, 3],
        [540, 0],
      ]),
    })
    // 08:00 menutup 08:00, 08:30, 09:00 -> sisa minimum 1 (dari 08:30).
    expect(slots.find((slot) => slot.startMinute === 480)?.remaining).toBe(1)
  })

  it('menjelaskan alasan saat kapasitas nol karena tidak ada dock', () => {
    const slots = computeAvailability({
      window,
      blocksRequired: 2,
      capacity: 0,
      usedByBlock: new Map(),
    })
    expect(slots[0]?.status).toBe('FULL')
    expect(slots[0]?.limitReason).toBe('Tidak ada dock aktif untuk aktivitas ini')
  })

  it('menandai slot yang tidak cukup waktu sebelum tutup', () => {
    const slots = computeAvailability({
      window,
      blocksRequired: 4,
      capacity: 4,
      usedByBlock: new Map(),
    })
    const late = slots.find((slot) => slot.startMinute === 960) // 16:00 + 2 jam = 18:00
    expect(late?.status).toBe('FULL')
    expect(late?.limitReason).toBe('Tidak cukup waktu sebelum jam tutup')
    expect(late?.endLabel).toBe('17:00')
  })
})

describe('minuteToLabel', () => {
  it('memformat menit sejak tengah malam', () => {
    expect(minuteToLabel(0)).toBe('00:00')
    expect(minuteToLabel(480)).toBe('08:00')
    expect(minuteToLabel(990)).toBe('16:30')
    expect(minuteToLabel(1439)).toBe('23:59')
  })
})
