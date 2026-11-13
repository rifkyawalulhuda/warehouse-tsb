import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import { MobileNav } from './mobile-nav'

const mocks = vi.hoisted(() => ({
  pathname: '/bookings/bkg-1',
  canGoBack: true,
  role: 'ADMIN' as string | null,
  pendingApprovals: 0,
  back: vi.fn(),
  setOpenMobile: vi.fn(),
}))

// Bilah ini hanya membaca judul yang didaftarkan halaman, jadi yang diuji di
// sini adalah pemakaiannya, bukan pendaftarannya.
vi.mock('@/context/page-title-provider', () => ({
  usePageTitle: () => 'Detail Booking',
}))

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ setOpenMobile: mocks.setOpenMobile }),
}))

// Halaman puncak ditentukan dari menu role, jadi role-nya ditetapkan eksplisit
// supaya tes tidak bergantung pada isi store yang tersisa dari tes lain.
vi.mock('@/stores/auth-store', () => ({
  useRole: () => mocks.role,
}))

// Angka persetujuan datang dari query jaringan; di sini yang diuji hanya
// tampilannya, jadi nilainya disuntikkan langsung.
vi.mock('@/hooks/use-pending-approvals', () => ({
  usePendingApprovals: () => mocks.pendingApprovals,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    // Meniru `useLocation` yang menerima selector, supaya tes benar-benar
    // memakai jalur yang sama dengan kode produksi.
    useLocation: (options?: {
      select?: (location: { pathname: string }) => unknown
    }) => {
      const location = { pathname: mocks.pathname }
      return options?.select ? options.select(location) : location
    },
    useRouter: () => ({
      history: {
        canGoBack: () => mocks.canGoBack,
        back: mocks.back,
      },
    }),
  }
})

const menuButton = () => page.getByRole('button', { name: /buka menu/i })
const backButton = () =>
  page.getByRole('button', { name: /kembali ke halaman sebelumnya/i })

describe('MobileNav', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.pathname = '/bookings/bkg-1'
    mocks.canGoBack = true
    mocks.role = 'ADMIN'
    mocks.pendingApprovals = 0
    // Bilah ini `md:hidden`, jadi viewport tesnya harus selebar ponsel.
    await page.viewport(390, 844)
  })

  it('membuka sheet navigasi saat tombol menu ditekan', async () => {
    await render(<MobileNav />)

    await userEvent.click(menuButton())

    expect(mocks.setOpenMobile).toHaveBeenCalledWith(true)
  })

  it('memakai riwayat browser saat tombol kembali ditekan', async () => {
    await render(<MobileNav />)

    await userEvent.click(backButton())

    expect(mocks.back).toHaveBeenCalledOnce()
  })

  it('menampilkan judul halaman yang didaftarkan halaman itu sendiri', async () => {
    await render(<MobileNav />)

    await expect.element(page.getByText('Detail Booking')).toBeVisible()
  })

  it('menyembunyikan tombol kembali di halaman puncak', async () => {
    mocks.pathname = '/dashboard'
    await render(<MobileNav />)

    expect(backButton().elements()).toHaveLength(0)
  })

  it('menyembunyikan tombol kembali saat tidak ada riwayat', async () => {
    // Tab yang dibuka langsung dari tautan WhatsApp: `back()` di sini akan
    // membawa pengguna keluar dari aplikasi.
    mocks.canGoBack = false
    await render(<MobileNav />)

    expect(backButton().elements()).toHaveLength(0)
  })

  it('menandai tombol menu saat ada persetujuan menunggu', async () => {
    // Tanpa penanda ini pengguna ponsel tidak punya isyarat apa pun sebelum
    // membuka menu — sidebar-nya tertutup.
    mocks.pendingApprovals = 3
    await render(<MobileNav />)

    await expect
      .element(page.getByRole('button', { name: /3 menunggu persetujuan/i }))
      .toBeVisible()
  })

  it('tidak menandai tombol menu saat antrean persetujuan kosong', async () => {
    await render(<MobileNav />)

    expect(
      page.getByRole('button', { name: /menunggu persetujuan/i }).elements()
    ).toHaveLength(0)
  })
})
