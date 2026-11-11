import { create } from 'zustand'
import type { Role, SessionUser } from '@/lib/api/types'

type AuthState = {
  user: SessionUser | null
  /** true selama sesi awal (GET /auth/me) belum selesai diperiksa. */
  loading: boolean
  setUser: (user: SessionUser | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

/**
 * Hanya profil yang disimpan di sini. Token sesi ada di cookie httpOnly
 * sehingga JavaScript tidak bisa membacanya (aman dari XSS).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ user: null, loading: false }),
}))

export function useCurrentUser() {
  return useAuthStore((state) => state.user)
}

export function useRole(): Role | null {
  return useAuthStore((state) => state.user?.role ?? null)
}

/** Nama perusahaan pemilik akun customer; null untuk staf. */
export function useCustomerName(): string | null {
  return useAuthStore((state) => state.user?.customerName ?? null)
}

/** Halaman beranda tiap peran setelah login. */
export function homeForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
      return '/dashboard'
    case 'CUSTOMER':
      return '/bookings'
    case 'GATE_OFFICER':
      return '/scan'
    case 'CHECKER':
      return '/dock'
  }
}
