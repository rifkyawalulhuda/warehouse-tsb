import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { fetchMe } from '@/lib/api/endpoints'
import { isUnauthorized } from '@/lib/api/client'

/**
 * Dipanggil sekali di root. Cookie sesi mungkin masih berlaku setelah reload,
 * jadi profil diambil ulang dari server sebelum rute dirender.
 */
export function useSessionBootstrap() {
  const setUser = useAuthStore((state) => state.setUser)
  const setLoading = useAuthStore((state) => state.setLoading)
  const loading = useAuthStore((state) => state.loading)

  useEffect(() => {
    let cancelled = false

    fetchMe()
      .then((user) => {
        if (!cancelled) setUser(user)
      })
      .catch((error) => {
        // 401 berarti memang belum login, bukan kondisi error yang perlu dilaporkan.
        // Kegagalan jaringan saat bootstrap sesi tidak punya tempat lain untuk
        // muncul, dan tanpa jejak ini sulit didiagnosis.
        // eslint-disable-next-line no-console
        if (!isUnauthorized(error)) console.warn('Gagal memuat sesi', error)
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [setUser, setLoading])

  return loading
}
