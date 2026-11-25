import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { AccountProfile } from '@/lib/api/types'
import { AccountPage } from './index'

// Halaman memakai <Link> yang butuh router; untuk tes ini yang dinilai isinya,
// bukan navigasinya.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const updateProfile = vi.fn()
const updateAccountEmail = vi.fn()
const updateAccountPassword = vi.fn()
const revokeOtherSessions = vi.fn()

vi.mock('@/lib/api/endpoints', () => ({
  fetchAccount: vi.fn(),
  updateProfile: (...args: unknown[]) => updateProfile(...args),
  updateAccountEmail: (...args: unknown[]) => updateAccountEmail(...args),
  updateAccountPassword: (...args: unknown[]) => updateAccountPassword(...args),
  revokeOtherSessions: (...args: unknown[]) => revokeOtherSessions(...args),
}))

function makeProfile(overrides: Partial<AccountProfile> = {}): AccountProfile {
  return {
    id: 'u1',
    name: 'Siti Nurhaliza',
    email: 'siti@gudang-nusantara.co.id',
    phone: '0812 3456 7890',
    role: 'ADMIN',
    customerName: null,
    canApproveBooking: true,
    createdAt: '2024-03-11T02:00:00.000Z',
    activeSessions: 1,
    ...overrides,
  }
}

async function mount(profile: AccountProfile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(['account'], profile)

  function Wrap({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  return render(<AccountPage />, { wrapper: Wrap })
}

/** Tombol simpan milik seksi yang judulnya disebut. */
async function saveButtonOf(
  screen: Awaited<ReturnType<typeof mount>>,
  section: string
) {
  const panels = screen.container.querySelectorAll('section')
  for (const panel of panels) {
    if (panel.querySelector('h2')?.textContent?.trim() !== section) continue
    const buttons = panel.querySelectorAll('button')
    const save = buttons[buttons.length - 1]
    if (save) return save as HTMLButtonElement
  }
  throw new Error(`Seksi "${section}" tidak ditemukan`)
}

describe('Pengaturan Akun', () => {
  it('menonaktifkan simpan profil sampai ada perubahan, lalu mengirim nilai terpangkas', async () => {
    updateProfile.mockResolvedValue(makeProfile({ name: 'Siti N.', phone: null }))
    const screen = await mount(makeProfile())

    const save = await saveButtonOf(screen, 'Profil')
    expect(save.disabled).toBe(true)

    const name = screen.getByLabelText('Nama lengkap')
    await userEvent.clear(name)
    await userEvent.type(name, '  Siti N.  ')

    await vi.waitFor(() => expect(save.disabled).toBe(false))
    await userEvent.click(save)

    // Spasi di ujung dipangkas sebelum dikirim; server tidak perlu memangkasnya
    // lagi dan nama tersimpan tidak berakhir dengan spasi.
    await vi.waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        name: 'Siti N.',
        phone: '0812 3456 7890',
      })
    )
  })

  it('menolak email yang tidak sama tanpa memanggil server', async () => {
    const screen = await mount(makeProfile())

    await userEvent.type(screen.getByLabelText('Email baru', { exact: true }), 'baru@gudang.id')
    await userEvent.type(
      screen.getByLabelText('Ulangi email baru', { exact: true }),
      'baru@gudang.com'
    )
    await userEvent.type(
      screen.getByLabelText('Kata sandi saat ini', { exact: true }),
      'rahasia123'
    )

    const save = await saveButtonOf(screen, 'Email')
    await vi.waitFor(() => expect(save.disabled).toBe(false))
    await userEvent.click(save)

    await expect
      .element(screen.getByText('Kedua email belum sama.'))
      .toBeInTheDocument()
    expect(updateAccountEmail).not.toHaveBeenCalled()
  })

  it('menolak email baru yang sama dengan email sekarang', async () => {
    const screen = await mount(makeProfile())

    // Huruf besar-kecil bukan perubahan: server menyimpan email dalam huruf
    // kecil, jadi kalau lolos pemeriksaan klien, server menolaknya dengan pesan
    // lain dan pengguna melihat dua kalimat berbeda untuk satu kesalahan.
    await userEvent.type(
      screen.getByLabelText('Email baru', { exact: true }),
      'SITI@Gudang-Nusantara.co.id'
    )
    await userEvent.type(
      screen.getByLabelText('Ulangi email baru', { exact: true }),
      'SITI@Gudang-Nusantara.co.id'
    )
    await userEvent.type(
      screen.getByLabelText('Kata sandi saat ini', { exact: true }),
      'rahasia123'
    )

    const save = await saveButtonOf(screen, 'Email')
    await vi.waitFor(() => expect(save.disabled).toBe(false))
    await userEvent.click(save)

    await expect
      .element(screen.getByText('Email baru sama dengan email sekarang.'))
      .toBeInTheDocument()
    expect(updateAccountEmail).not.toHaveBeenCalled()
  })

  it('menolak kata sandi baru yang tidak sama tanpa memanggil server', async () => {
    const screen = await mount(makeProfile())

    await userEvent.type(
      screen.getByLabelText('Kata sandi sekarang', { exact: true }),
      'rahasia123'
    )
    await userEvent.type(
      screen.getByLabelText('Kata sandi baru', { exact: true }),
      'sandibaru123'
    )
    await userEvent.type(
      screen.getByLabelText('Ulangi kata sandi baru', { exact: true }),
      'sandibaru124'
    )

    const save = await saveButtonOf(screen, 'Kata sandi')
    await vi.waitFor(() => expect(save.disabled).toBe(false))
    await userEvent.click(save)

    await expect
      .element(screen.getByText('Kedua kata sandi baru belum sama.'))
      .toBeInTheDocument()
    expect(updateAccountPassword).not.toHaveBeenCalled()
  })

  it('menonaktifkan tombol keluarkan bila hanya perangkat ini yang masuk', async () => {
    const screen = await mount(makeProfile({ activeSessions: 1 }))

    await expect
      .element(screen.getByText('1 perangkat sedang masuk'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Keluarkan perangkat lain' }))
      .toBeDisabled()
    await expect
      .element(screen.getByText('Hanya perangkat ini.'))
      .toBeInTheDocument()
  })

  it('menawarkan keluarkan perangkat lain saat ada sesi kedua', async () => {
    const screen = await mount(makeProfile({ activeSessions: 3 }))

    await expect
      .element(screen.getByText('3 perangkat sedang masuk'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('button', { name: 'Keluarkan perangkat lain' }))
      .toBeEnabled()
  })

  it('tidak menampilkan tautan Pengaturan Gudang untuk non-Admin', async () => {
    const screen = await mount(
      makeProfile({ role: 'CHECKER', canApproveBooking: false })
    )

    // Checker tidak berhak membuka /settings; tautan yang tetap tampil hanya
    // akan berakhir di 403.
    expect(screen.container.textContent).not.toContain('Buka Pengaturan Gudang')
  })

  it('menampilkan perusahaan untuk akun customer', async () => {
    const screen = await mount(
      makeProfile({
        role: 'CUSTOMER',
        canApproveBooking: false,
        customerName: 'PT Alpha Logistik',
      })
    )

    await expect
      .element(screen.getByText('PT Alpha Logistik'))
      .toBeInTheDocument()
  })
})