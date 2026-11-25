import { describe, expect, it } from 'vitest'
import { safeLogoUrl } from './logo'

/**
 * Urutan penting: kartu di layar dan kanvas PNG memakai fungsi ini, jadi setiap
 * penolakan di sini berarti logo hilang di keduanya — bukan hanya di PNG.
 */
describe('safeLogoUrl', () => {
  it('membiarkan logo unggahan sendiri', () => {
    const url = safeLogoUrl('/api/uploads/logo-abc.png')
    expect(url).toBe(`${window.location.origin}/api/uploads/logo-abc.png`)
  })

  it('membiarkan data URL', () => {
    expect(safeLogoUrl('data:image/png;base64,AAAA')).toBe(
      'data:image/png;base64,AAAA'
    )
  })

  it('menolak gambar dari domain lain', () => {
    expect(safeLogoUrl('https://cdn.contoh.com/logo.png')).toBeNull()
    // Protokol-relatif juga menunjuk domain lain.
    expect(safeLogoUrl('//cdn.contoh.com/logo.png')).toBeNull()
  })

  it('menolak skema yang bukan gambar', () => {
    expect(safeLogoUrl('javascript:alert(1)')).toBeNull()
  })

  it('menganggap kosong sebagai tanpa logo', () => {
    expect(safeLogoUrl(null)).toBeNull()
    expect(safeLogoUrl(undefined)).toBeNull()
    expect(safeLogoUrl('   ')).toBeNull()
  })
})