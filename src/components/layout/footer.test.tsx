import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { Footer } from './footer'
import { DEFAULT_BRANDING } from '@/lib/branding'

type Branding = typeof DEFAULT_BRANDING

// `vi.hoisted` berjalan sebelum impor, jadi isinya tidak boleh menyentuh nilai
// yang diimpor (DEFAULT_BRANDING belum ada saat itu). Nilai awalnya ditulis
// apa adanya; tiap tes menggantinya dengan spread DEFAULT_BRANDING.
const branding = vi.hoisted(() => ({
  current: {} as {
    footerCompany: string | null
    footerLocation: string | null
    footerShowLocation: boolean
  },
}))

vi.mock('@/lib/branding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/branding')>()
  return {
    ...actual,
    useBranding: () => branding.current,
  }
})

function useBrandingWith(overrides: Partial<Branding>) {
  branding.current = { ...DEFAULT_BRANDING, ...overrides }
}

describe('Footer', () => {
  it('memakai teks bawaan bila Admin belum mengisinya', async () => {
    useBrandingWith({ footerCompany: null, footerLocation: null })

    const { getByText } = await render(<Footer />)

    const year = new Date().getFullYear()
    await expect
      .element(
        getByText(`${year} TSB · Warehouse Time Slot Booking`, {
          exact: false,
        })
      )
      .toBeInTheDocument()
    await expect
      .element(getByText('Gudang Cikarang · Shift 1'))
      .toBeInTheDocument()
  })

  it('memakai teks dari Admin dan tetap menghitung tahun sendiri', async () => {
    useBrandingWith({
      footerCompany: 'PT Contoh Logistik',
      footerLocation: 'Gudang Bekasi · Shift 2',
    })

    const { getByText } = await render(<Footer />)

    const year = new Date().getFullYear()
    await expect
      .element(getByText(`${year} PT Contoh Logistik`, { exact: false }))
      .toBeInTheDocument()
    await expect
      .element(getByText('Gudang Bekasi · Shift 2'))
      .toBeInTheDocument()
    // Teks bawaan tidak boleh tertinggal di samping teks baru.
    expect(document.body.textContent).not.toContain('Gudang Cikarang')
  })

  it('menyembunyikan baris lokasi beserta pemisahnya bila dimatikan', async () => {
    useBrandingWith({
      footerCompany: 'PT Contoh Logistik, Cikarang',
      footerLocation: null,
      footerShowLocation: false,
    })

    const { getByText } = await render(<Footer />)

    const year = new Date().getFullYear()
    await expect
      .element(getByText(`${year} PT Contoh Logistik, Cikarang`, { exact: false }))
      .toBeInTheDocument()
    // Baris lokasi hilang, dan bullet tidak boleh tertinggal sendirian.
    expect(document.body.textContent).not.toContain('Gudang Cikarang')
    expect(document.body.textContent).not.toContain('•')
  })

  it('tetap menampilkan baris lokasi secara bawaan', async () => {
    useBrandingWith({ footerShowLocation: true })

    await render(<Footer />)

    await expect
      .element(document.body)
      .toHaveTextContent('Gudang Cikarang · Shift 1')
  })
})