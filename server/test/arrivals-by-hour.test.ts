import { describe, expect, it } from 'vitest'
import { buildArrivalsByHour } from '../src/modules/reports/aggregate'
import { jakartaInstant } from '../src/lib/time'

/**
 * Grafik kedatangan harus menjumlahkan SELURUH gate-in yang dilaporkan KPI.
 *
 * Truk boleh masuk sebelum gudang buka (sebatas `earlyArrivalLimitMinutes`)
 * dan masih dilayani setelah jam tutup selama hari operasional belum berakhir.
 * Versi pertama fungsi ini hanya membuat batang untuk jam operasional, jadi
 * kedatangan di luar jam itu lenyap dari grafik tanpa jejak: total batang lebih
 * kecil dari `kpi` "truk masuk" dan tidak ada yang menyadarinya.
 */
const DAY = '2026-11-13'
const WINDOW = { operatingStartMinute: 8 * 60, operatingEndMinute: 17 * 60 }

function at(hour: number, minute = 0): Date {
  return jakartaInstant(DAY, hour * 60 + minute)
}

function total(rows: readonly { arrivals: number }[]): number {
  return rows.reduce((sum, row) => sum + row.arrivals, 0)
}

describe('buildArrivalsByHour', () => {
  it('membuat satu batang per jam operasional walau tidak ada kedatangan', () => {
    const rows = buildArrivalsByHour([], WINDOW)

    expect(rows.map((row) => row.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16])
    expect(rows.every((row) => row.arrivals === 0)).toBe(true)
    expect(rows[0]!.label).toBe('08.00')
  })

  it('tidak membuang kedatangan sebelum gudang buka', () => {
    const rows = buildArrivalsByHour([at(7, 30), at(9), at(9, 45)], WINDOW)

    expect(rows[0]!.hour).toBe(7)
    expect(rows[0]!.arrivals).toBe(1)
    expect(rows.find((row) => row.hour === 9)!.arrivals).toBe(2)
    expect(total(rows)).toBe(3)
  })

  it('tidak membuang kedatangan setelah jam tutup', () => {
    const rows = buildArrivalsByHour([at(9), at(17, 20), at(18, 5)], WINDOW)

    expect(rows.at(-1)!.hour).toBe(18)
    expect(rows.at(-1)!.arrivals).toBe(1)
    expect(total(rows)).toBe(3)
  })

  it('mempertahankan urutan jam yang menaik', () => {
    const hours = buildArrivalsByHour([at(6), at(10), at(19)], WINDOW).map(
      (row) => row.hour
    )

    expect(hours).toEqual([...hours].sort((a, b) => a - b))
    expect(hours).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  })
})
