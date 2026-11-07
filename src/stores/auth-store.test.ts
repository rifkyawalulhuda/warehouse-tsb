import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/api/types'

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser: SessionUser = {
  id: 'u1',
  name: 'Budi',
  email: 'budi@example.com',
  role: 'CUSTOMER',
  companyName: 'PT Contoh',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('mulai tanpa pengguna dan menandai sesi masih diperiksa', async () => {
    const useAuthStore = await importAuthStore()
    const state = useAuthStore.getState()

    expect(state.user).toBeNull()
    expect(state.loading).toBe(true)
  })

  it('menyimpan pengguna lewat setUser', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().setUser(sampleUser)

    expect(useAuthStore.getState().user).toEqual(sampleUser)
  })

  it('reset mengosongkan pengguna dan menghentikan loading', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().setUser(sampleUser)

    useAuthStore.getState().reset()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().loading).toBe(false)
  })

  it('setLoading mengubah status pemeriksaan sesi', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().setLoading(false)

    expect(useAuthStore.getState().loading).toBe(false)
  })
})
