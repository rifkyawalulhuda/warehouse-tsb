import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SessionLoading } from '@/components/require-auth'
import { homeForRole, useAuthStore } from '@/stores/auth-store'

/**
 * Beranda hanya meneruskan ke rumah peran masing-masing. Redirect dilakukan di
 * komponen, bukan `beforeLoad`, karena sesi masih diperiksa saat rute dimuat.
 */
export const Route = createFileRoute('/_authenticated/')({
  component: HomeRedirect,
})

function HomeRedirect() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    if (!user) return
    void navigate({ to: homeForRole(user.role), replace: true })
  }, [user, navigate])

  return <SessionLoading />
}
