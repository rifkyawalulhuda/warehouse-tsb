import { describe, expect, it } from 'vitest'
import type { Settings } from '@/lib/api/types'
import {
  dirtySections,
  hoursNote,
  impactOf,
  isDirty,
  restoreSection,
  sectionError,
  sectionPayload,
  toForm,
} from './form'

const settings: Settings = {
  warehouseName: 'Gudang TSB Cikarang',
  appName: 'Warehouse TSB',
  appTagline: 'Time Slot Booking',
  appShortName: null,
  loginCoverUrl: null,
  loginBrandColor: null,
  operatingStartMinute: 480,
  operatingEndMinute: 1020,
  operatingStartLabel: '08:00',
  operatingEndLabel: '17:00',
  slotUnitMinutes: 30,
  gracePeriodMinutes: 15,
  earlyArrivalLimitMinutes: 60,
  bookingWindowDays: 7,
  approvalMode: 'AUTO',
  approvalLeadMinutes: 120,
  approvalMinDecisionMinutes: 30,
  approvalUrgentBufferMinutes: 60,
  capacity: { LOADING: 3, UNLOADING: 2 },
  blocksPerDay: 18,
  truckTypes: [],
}

describe('toForm', () => {
  it('memakai label jam dari server, bukan mengubah menit sendiri', () => {
    const form = toForm(settings)
    expect(form.open).toBe('08:00')
    expect(form.close).toBe('17:00')
    expect(form.slotUnitMinutes).toBe('30')
    expect(form.approvalMode).toBe('AUTO')
  })
})

describe('status kotor per seksi', () => {
  const saved = toForm(settings)

  it('perubahan di satu seksi tidak menandai seksi lain', () => {
    const form = { ...saved, bookingWindowDays: '14' }
    expect(isDirty('window', form, saved)).toBe(true)
    expect(isDirty('hours', form, saved)).toBe(false)
    expect(dirtySections(form, saved)).toEqual(['window'])
  })

  it('menandai perubahan hanya teks nama sebagai kotor', () => {
    const form = { ...saved, warehouseName: 'Gudang TSB Cikarang 2' }
    expect(dirtySections(form, saved)).toEqual(['identity'])
  })

  it('mengembalikan satu seksi tanpa menyentuh draf seksi lain', () => {
    const form = { ...saved, open: '07:00', bookingWindowDays: '14' }
    const restored = restoreSection(form, saved, 'hours')

    expect(restored.open).toBe('08:00')
    expect(restored.bookingWindowDays).toBe('14')
    expect(dirtySections(restored, saved)).toEqual(['window'])
  })
})

describe('seksi nama aplikasi', () => {
  const saved = toForm(settings)

  it('memisahkan draf merek dari identitas gudang', () => {
    const form = { ...saved, appName: 'TSB Dock' }
    expect(dirtySections(form, saved)).toEqual(['branding'])

    const restored = restoreSection(
      { ...form, warehouseName: 'Gudang Lain' },
      saved,
      'branding'
    )
    expect(restored.appName).toBe('Warehouse TSB')
    expect(restored.warehouseName).toBe('Gudang Lain')
  })

  it('menolak judul kosong — header tidak boleh tanpa nama', () => {
    expect(sectionError('branding', { ...saved, appName: '   ' })).toBe(
      'Judul aplikasi wajib diisi.'
    )
    expect(sectionError('branding', saved)).toBeNull()
  })

  it('menolak teks yang lebih panjang dari kolom database', () => {
    expect(
      sectionError('branding', { ...saved, appName: 'a'.repeat(61) })
    ).toContain('maksimal 60')
    expect(
      sectionError('branding', { ...saved, appTagline: 'a'.repeat(81) })
    ).toContain('Subjudul maksimal 80')
    expect(
      sectionError('branding', { ...saved, appShortName: 'a'.repeat(21) })
    ).toContain('Nama pendek maksimal 20')
  })

  it('mengirim nama pendek kosong sebagai null, bukan string kosong', () => {
    expect(sectionPayload('branding', { ...saved, appShortName: '  ' })).toEqual(
      {
        appName: 'Warehouse TSB',
        appTagline: 'Time Slot Booking',
        appShortName: null,
        loginCoverUrl: null,
        loginBrandColor: null,
      }
    )
    expect(
      sectionPayload('branding', { ...saved, appShortName: ' TSB ' })
    ).toMatchObject({ appShortName: 'TSB' })
  })

  it('membaca null dari server sebagai kolom kosong di form', () => {
    expect(toForm(settings).appShortName).toBe('')
    expect(toForm({ ...settings, appShortName: 'TSB' }).appShortName).toBe('TSB')
  })
})

describe('validasi seksi', () => {
  const saved = toForm(settings)

  it('menolak satuan blok yang tidak membagi habis jam operasional', () => {
    const form = { ...saved, slotUnitMinutes: '45' }
    // 08:00–17:00 = 540 menit; 540 / 45 = 12, jadi masih habis dibagi.
    expect(sectionError('hours', form)).toBeNull()

    expect(
      sectionError('hours', { ...saved, open: '08:00', close: '17:20' })
    ).toContain('tidak habis dibagi')
  })

  it('menolak jam tutup yang mendahului jam buka', () => {
    const form = { ...saved, open: '17:00', close: '08:00' }
    expect(sectionError('hours', form)).toBe(
      'Jam tutup harus setelah jam buka.'
    )
  })

  it('menolak field angka yang dikosongkan, bukan membacanya sebagai nol', () => {
    expect(sectionError('window', { ...saved, bookingWindowDays: '' })).toBe(
      'Jendela pemesanan harus 1–90 hari.'
    )
    // Masa tenggang boleh nol, tapi tetap tidak boleh kosong.
    expect(
      sectionError('arrival', { ...saved, gracePeriodMinutes: '' })
    ).not.toBeNull()
    expect(
      sectionError('arrival', { ...saved, gracePeriodMinutes: '0' })
    ).toBeNull()
  })

  it('menolak nama gudang kosong', () => {
    expect(sectionError('identity', { ...saved, warehouseName: '  ' })).toBe(
      'Nama gudang minimal 2 karakter.'
    )
  })
})

describe('payload seksi', () => {
  it('hanya memuat field seksi tersebut, dengan nama jam kembali ke menit', () => {
    const form = { ...toForm(settings), open: '06:30', close: '15:00' }
    expect(sectionPayload('hours', form)).toEqual({
      operatingStartMinute: 390,
      operatingEndMinute: 900,
      slotUnitMinutes: 30,
    })
  })

  it('memangkas spasi pada nama gudang', () => {
    const form = { ...toForm(settings), warehouseName: '  Gudang B  ' }
    expect(sectionPayload('identity', form)).toEqual({
      warehouseName: 'Gudang B',
    })
  })
})

describe('ringkasan dampak', () => {
  it('menghitung blok per hari dari draf, bukan dari server', () => {
    const impact = impactOf({ ...toForm(settings), slotUnitMinutes: '60' })
    expect(impact.hours).toBe('08:00–17:00')
    expect(impact.duration).toBe('9 jam')
    expect(impact.blocks).toBe('9 blok')
  })

  it('menampilkan durasi berpecahan dengan koma desimal', () => {
    const impact = impactOf({
      ...toForm(settings),
      open: '08:00',
      close: '16:30',
    })
    expect(impact.duration).toBe('8,5 jam')
  })

  it('tidak mengarang angka saat draf belum valid', () => {
    const impact = impactOf({
      ...toForm(settings),
      open: '',
      close: '',
      slotUnitMinutes: '',
    })
    expect(impact.hours).toBe('—')
    expect(impact.blocks).toBe('—')
    expect(impact.duration).toBe('—')
  })
})

describe('catatan sisa menit', () => {
  it('menyebut sisa menit yang tidak masuk blok', () => {
    expect(hoursNote('08:00', '17:20', '30')).toContain('20 menit')
  })

  it('diam saat rentang habis dibagi', () => {
    expect(hoursNote('08:00', '17:00', '30')).toBeNull()
  })
})
