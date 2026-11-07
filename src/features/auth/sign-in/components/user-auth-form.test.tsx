import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const MESSAGES = {
  emailInvalid: 'Masukkan email yang valid.',
  passwordEmpty: 'Masukkan password.',
  badCredentials: 'Email atau password salah.',
} as const

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@/lib/api/endpoints', () => ({
  login: mocks.login,
}))

// Store sungguhan dipanggil dengan selector, jadi mock-nya harus fungsi yang
// menerima selector dan mengembalikan nilai dari state tiruan.
vi.mock('@/stores/auth-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth-store')>()
  return {
    ...actual,
    useAuthStore: (selector: (state: { setUser: () => void }) => unknown) =>
      selector({ setUser: mocks.setUser }),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

const adminUser = {
  id: 1,
  name: 'Admin TSB',
  email: 'admin@tsb.test',
  role: 'ADMIN' as const,
}

describe('UserAuthForm', () => {
  let screen: RenderResult
  let emailInput: Locator
  let passwordInput: Locator
  let submitButton: Locator

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.login.mockResolvedValue(adminUser)
    screen = await render(<UserAuthForm />)
    emailInput = screen.getByRole('textbox', { name: /^Email$/i })
    passwordInput = screen.getByLabelText(/^Password$/i)
    submitButton = screen.getByRole('button', { name: /^Masuk$/i })
  })

  it('menampilkan email, password, dan tombol masuk', async () => {
    await expect.element(emailInput).toBeInTheDocument()
    await expect.element(passwordInput).toBeInTheDocument()
    await expect.element(submitButton).toBeInTheDocument()
  })

  it('menolak email yang tidak valid', async () => {
    await userEvent.fill(emailInput, 'bukan-email')
    await userEvent.fill(passwordInput, 'apapun')
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText(MESSAGES.emailInvalid))
      .toBeInTheDocument()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('menolak password kosong', async () => {
    await userEvent.fill(emailInput, 'admin@tsb.test')
    await userEvent.click(submitButton)

    await expect
      .element(screen.getByText(MESSAGES.passwordEmpty))
      .toBeInTheDocument()
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('menyimpan user dan membuka beranda sesuai peran setelah login', async () => {
    await userEvent.fill(emailInput, 'admin@tsb.test')
    await userEvent.fill(passwordInput, 'Rahasia123')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(mocks.login).toHaveBeenCalledOnce())
    expect(mocks.login).toHaveBeenCalledWith('admin@tsb.test', 'Rahasia123')
    expect(mocks.setUser).toHaveBeenCalledWith(adminUser)

    // Admin mendarat di dashboard, bukan di "/" yang tidak ada.
    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/dashboard',
        replace: true,
      })
    )
  })

  it('menghormati redirectTo bila diberikan', async () => {
    // Form dari beforeEach dilepas dulu supaya query tidak menemukan dua input
    // email sekaligus.
    await screen.unmount()
    vi.clearAllMocks()
    mocks.login.mockResolvedValue(adminUser)
    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/settings' />
    )

    await userEvent.fill(getByRole('textbox', { name: /Email/i }), 'a@b.com')
    await userEvent.fill(getByLabelText('Password'), '1234567')
    await userEvent.click(getByRole('button', { name: /Masuk/i }))

    await vi.waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/settings',
        replace: true,
      })
    )
  })

  it('menampilkan pesan galat saat kredensial ditolak', async () => {
    mocks.login.mockRejectedValue({
      response: { data: { error: { message: MESSAGES.badCredentials } } },
    })

    await userEvent.fill(emailInput, 'admin@tsb.test')
    await userEvent.fill(passwordInput, 'salah')
    await userEvent.click(submitButton)

    await vi.waitFor(() => expect(mocks.login).toHaveBeenCalledOnce())
    expect(mocks.setUser).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})
