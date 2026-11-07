import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SearchProvider } from '@/context/search-provider'

const COMMAND_MENU_PLACEHOLDER = 'Type a command or search...'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  }
})

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ setTheme: mocks.setTheme }),
}))

// Menu pencarian dibangun dari navigasi peran, jadi tes harus memakai peran
// nyata (di sini admin) agar daftar itemnya sama dengan yang dilihat pengguna.
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        id: 1,
        name: 'Admin TSB',
        email: 'admin@tsb.test',
        role: 'ADMIN',
      },
    }),
}))

type ShortcutModifier = 'Control' | 'Meta'

async function renderWithSearchProvider() {
  return await render(<SearchProvider>{null}</SearchProvider>)
}

/**
 * Buka palette lewat shortcut, dengan percobaan ulang selama listener keydown
 * belum terpasang. Ada jeda antar percobaan supaya toggle yang berhasil tidak
 * langsung dibatalkan oleh chord kedua.
 */
async function openCommandPalette(
  screen: RenderResult,
  modifier: ShortcutModifier = 'Control'
) {
  await vi.waitFor(
    async () => {
      const isOpen =
        document.querySelector(
          `[placeholder="${COMMAND_MENU_PLACEHOLDER}"]`
        ) !== null

      if (!isOpen) {
        await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`)
      }

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .toBeInTheDocument()
    },
    { interval: 50, timeout: 5000 }
  )
}

describe('SearchProvider and CommandMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('menampilkan item navigasi dan pilihan tema saat palette terbuka', async () => {
    const screen = await renderWithSearchProvider()
    const { getByPlaceholder, getByText } = screen

    await openCommandPalette(screen)

    await expect
      .element(getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .toBeInTheDocument()
    await expect.element(getByText('Theme')).toBeInTheDocument()
    await expect.element(getByText('Light')).toBeInTheDocument()
    await expect.element(getByText('Dark')).toBeInTheDocument()
    await expect.element(getByText('System')).toBeInTheDocument()
    await expect.element(getByText('Dashboard')).toBeInTheDocument()
    await expect.element(getByText('Laporan')).toBeInTheDocument()
  })

  it('tidak menampilkan palette saat pencarian tertutup', async () => {
    const { getByPlaceholder } = await renderWithSearchProvider()

    await expect
      .element(getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it.each([
    ['Ctrl', 'Control'],
    ['Cmd', 'Meta'],
  ] as const)(
    'membuka palette saat %s + K ditekan',
    async (_label, modifier) => {
      const screen = await renderWithSearchProvider()

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .not.toBeInTheDocument()

      await openCommandPalette(screen, modifier)

      await expect
        .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
        .toBeInTheDocument()
    }
  )

  it('menavigasi ke rute dan menutup palette saat item dipilih', async () => {
    const screen = await renderWithSearchProvider()

    await openCommandPalette(screen)

    await userEvent.click(screen.getByText('Papan Dock'))

    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/dock' })
    await expect
      .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it('menerapkan tema dan menutup palette saat perintah tema dipilih', async () => {
    const screen = await renderWithSearchProvider()

    await openCommandPalette(screen)

    await userEvent.click(screen.getByText('Dark'))

    expect(mocks.setTheme).toHaveBeenCalledWith('dark')
    await expect
      .element(screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER))
      .not.toBeInTheDocument()
  })

  it('menampilkan keadaan kosong saat filter tidak cocok', async () => {
    const screen = await renderWithSearchProvider()

    await openCommandPalette(screen)

    await userEvent.fill(
      screen.getByPlaceholder(COMMAND_MENU_PLACEHOLDER),
      'zzzz-no-match-xxxx'
    )

    await expect
      .element(screen.getByText('No results found.'))
      .toBeInTheDocument()
  })
})
