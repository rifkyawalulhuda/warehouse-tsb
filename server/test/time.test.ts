import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  dateOnlyToUtc,
  jakartaInstant,
  minuteOfDayJakarta,
  minuteToLabel,
  labelToMinute,
  utcToDateOnly,
} from '../src/lib/time'

describe('jakartaInstant', () => {
  it('mengubah jam operasional menjadi instant UTC yang benar', () => {
    // 08:00 Jakarta (UTC+7) = 01:00 UTC.
    expect(jakartaInstant('2026-11-07', 480).toISOString()).toBe('2026-11-07T01:00:00.000Z')
    // 16:30 Jakarta = 09:30 UTC.
    expect(jakartaInstant('2026-11-07', 990).toISOString()).toBe('2026-11-07T09:30:00.000Z')
  })

  it('tetap benar untuk jam yang melewati tengah malam UTC', () => {
    // 00:30 Jakarta tanggal 8 = 17:30 UTC tanggal 7.
    expect(jakartaInstant('2026-11-08', 30).toISOString()).toBe('2026-11-07T17:30:00.000Z')
  })

  it('bolak-balik dengan minuteOfDayJakarta', () => {
    for (const minute of [0, 480, 540, 990, 1439]) {
      expect(minuteOfDayJakarta(jakartaInstant('2026-11-07', minute))).toBe(minute)
    }
  })
})

describe('tanggal operasional', () => {
  it('dateOnlyToUtc selalu tengah malam UTC, bukan zona lokal', () => {
    expect(dateOnlyToUtc('2026-11-07').toISOString()).toBe('2026-11-07T00:00:00.000Z')
  })

  it('utcToDateOnly mengembalikan tanggal yang sama', () => {
    expect(utcToDateOnly(dateOnlyToUtc('2026-11-07'))).toBe('2026-11-07')
  })

  it('addDaysISO melewati batas bulan dan tahun', () => {
    expect(addDaysISO('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('label jam', () => {
  it('minuteToLabel dan labelToMinute saling melengkapi', () => {
    for (const minute of [0, 480, 990, 1439]) {
      expect(labelToMinute(minuteToLabel(minute))).toBe(minute)
    }
  })
})
