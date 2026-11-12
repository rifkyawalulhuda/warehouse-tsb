import { describe, expect, it } from 'vitest'
import { brandInitial, tabTitle } from './branding'

describe('brandInitial', () => {
  it('memakai huruf pertama dari kata pertama', () => {
    expect(brandInitial('Warehouse TSB')).toBe('W')
    expect(brandInitial('gudang utama')).toBe('G')
  })

  it('melewati spasi dan tanda baca di depan, bukan menampilkannya', () => {
    // Judul seperti "- TSB" tidak boleh menghasilkan lencana kosong.
    expect(brandInitial('  - TSB')).toBe('T')
    expect(brandInitial('· · ·')).toBe('T')
  })

  it('jatuh ke huruf cadangan saat judul kosong', () => {
    expect(brandInitial('')).toBe('T')
  })
})

describe('tabTitle', () => {
  it('memakai nama pendek bila diisi', () => {
    expect(tabTitle('Warehouse TSB', 'TSB')).toBe('TSB')
  })

  it('memakai judul penuh bila nama pendek kosong', () => {
    expect(tabTitle('Warehouse TSB', null)).toBe('Warehouse TSB')
    expect(tabTitle('Warehouse TSB', '   ')).toBe('Warehouse TSB')
  })
})
