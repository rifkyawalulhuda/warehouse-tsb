import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { SessionUser } from '@/lib/api/types'
import { api } from './client'

/**
 * Interceptor 401 adalah satu-satunya bagian klien yang, bila salah, membuat
 * SEMUA pengguna terlempar keluar atau memicu gelombang permintaan refresh.
 * `client.test.ts` hanya menguji `apiErrorMessage`, jadi perilaku ini tidak
 * pernah dijaga.
 *
 * Tes berjalan tanpa jaringan: tiap permintaan memakai adapter sendiri, dan
 * `axios.post` (dipakai `refreshSession`) diganti tiruan.
 */
function adapter(
  respond: (config: { url?: string; attempt: number }) => number
): AxiosAdapter {
  const attempts = new Map<string, number>()
  return async (config) => {
    const url = config.url ?? ''
    const attempt = (attempts.get(url) ?? 0) + 1
    attempts.set(url, attempt)

    const status = respond({ url, attempt })
    const response: AxiosResponse = {
      data: { data: { ok: true } },
      status,
      statusText: String(status),
      headers: {},
      config,
    }
    if (status >= 200 && status < 300) return response
    throw new AxiosError(
      `Request failed with status ${status}`,
      String(status),
      config,
      null,
      response
    )
  }
}

const sessionUser: SessionUser = {
  id: 'user-1',
  name: 'Admin Tes',
  email: 'admin@test.local',
  phone: null,
  role: 'ADMIN',
  customerId: null,
  customerName: null,
  canApproveBooking: false,
}

beforeEach(() => {
  useAuthStore.setState({ user: sessionUser, loading: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.setState({ user: null, loading: false })
})

describe('interceptor 401', () => {
  it('menyegarkan sesi sekali untuk banyak permintaan yang gagal bersamaan', async () => {
    const refresh = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { data: {} } } as never)

    // Permintaan pertama 401, percobaan kedua berhasil.
    const makeAdapter = () =>
      adapter(({ attempt }) => (attempt === 1 ? 401 : 200))

    const results = await Promise.all([
      api.get('/bookings', { adapter: makeAdapter() }),
      api.get('/ops/queue', { adapter: makeAdapter() }),
      api.get('/approvals', { adapter: makeAdapter() }),
    ])

    expect(results.every((response) => response.status === 200)).toBe(true)
    // Single-flight: tiga kegagalan, satu panggilan refresh.
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('tidak mengulang permintaan yang tetap 401 setelah refresh', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { data: {} } } as never)

    // Selalu 401: tanpa penjaga `_retried` ini akan berputar tanpa henti.
    const always = adapter(() => 401)
    let calls = 0
    const counting: AxiosAdapter = (config) => {
      calls += 1
      return always(config)
    }

    await expect(
      api.get('/bookings', { adapter: counting })
    ).rejects.toBeTruthy()
    // Sekali percobaan awal + sekali setelah refresh, lalu menyerah.
    expect(calls).toBe(2)
  })

  it('tidak mencoba refresh untuk kegagalan login', async () => {
    const refresh = vi.spyOn(axios, 'post')

    await expect(
      api.post('/auth/login', {}, { adapter: adapter(() => 401) })
    ).rejects.toBeTruthy()

    expect(refresh).not.toHaveBeenCalled()
    // Sesi yang ada tidak boleh dibuang hanya karena salah kata sandi.
    expect(useAuthStore.getState().user).toEqual(sessionUser)
  })

  it('mengosongkan sesi lokal ketika refresh ditolak', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('Unauthorized', '401')
    )

    await expect(
      api.get('/bookings', { adapter: adapter(() => 401) })
    ).rejects.toBeTruthy()

    // `RequireAuth` melihat `user === null` dan mengarahkan ke halaman masuk
    // sekali, alih-alih setiap pemanggil menampilkan toast sendiri di halaman
    // yang datanya sudah basi.
    expect(useAuthStore.getState().user).toBeNull()
  })
})
