import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SignOutDialog } from './sign-out-dialog'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  reset: vi.fn(),
  clear: vi.fn(),
  logout: vi.fn(),
}))

const MOCK_HREF = 'https://app.test/dashboard?tab=1'

vi.mock('@/lib/api/endpoints', () => ({
  logout: mocks.logout,
}))

// Store sungguhan dipanggil dengan selector, jadi mock-nya harus fungsi yang
// menerima selector dan mengembalikan nilai dari state tiruan.
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { reset: () => void }) => unknown) =>
    selector({ reset: mocks.reset }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ clear: mocks.clear }),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ href: MOCK_HREF }),
  }
})

describe('SignOutDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logout.mockResolvedValue(undefined)
  })

  it('menghapus sesi dan kembali ke sign-in dengan redirect halaman saat ini', async () => {
    const onOpenChange = vi.fn()
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={onOpenChange} />
    )

    await userEvent.click(getByRole('button', { name: /^Keluar$/i }))

    await vi.waitFor(() => expect(mocks.reset).toHaveBeenCalledOnce())
    expect(mocks.logout).toHaveBeenCalledOnce()
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: MOCK_HREF },
      replace: true,
    })
  })

  it('tetap keluar walau server tidak merespons', async () => {
    mocks.logout.mockRejectedValue(new Error('offline'))
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Keluar$/i }))

    // Sesi lokal tetap dibersihkan: kalau tidak, pengguna terjebak di layar
    // yang mengira dirinya masih login.
    await vi.waitFor(() => expect(mocks.reset).toHaveBeenCalledOnce())
    expect(mocks.navigate).toHaveBeenCalledOnce()
  })

  it('tidak melakukan apa pun saat Batal diklik', async () => {
    const { getByRole } = await render(
      <SignOutDialog open onOpenChange={vi.fn()} />
    )

    await userEvent.click(getByRole('button', { name: /^Batal$/i }))

    expect(mocks.logout).not.toHaveBeenCalled()
    expect(mocks.reset).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
