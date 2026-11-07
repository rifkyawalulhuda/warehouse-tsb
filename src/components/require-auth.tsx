import { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import type { Role } from '@/lib/api/types'
import { homeForRole, useAuthStore } from '@/stores/auth-store'

export function SessionLoading() {
  return (
    <div className='flex h-svh items-center justify-center'>
      <Loader2 className='size-6 animate-spin text-muted-foreground' />
    </div>
  )
}

/**
 * Menahan rute sampai sesi diketahui. Tanpa ini halaman admin sempat berkedip
 * sebelum redirect ke /sign-in. Peran yang tidak berhak dikembalikan ke beranda
 * perannya sendiri, bukan halaman error, supaya tidak terasa seperti kegagalan.
 */
export function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[]
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const href = useRouterState({ select: (state) => state.location.href })
  const user = useAuthStore((state) => state.user)
  const loading = useAuthStore((state) => state.loading)

  const wrongRole = !!user && !!roles && !roles.includes(user.role)
  // Saat rute ini masih ter-mount sesaat setelah navigate, `href` sudah berubah
  // menjadi /sign-in. Tanpa penjagaan ini efeknya berjalan lagi dan menumpuk
  // parameter redirect tanpa henti.
  const onSignIn = href.startsWith('/sign-in')

  useEffect(() => {
    if (loading || onSignIn) return
    if (!user) {
      void navigate({
        to: '/sign-in',
        search: { redirect: href },
        replace: true,
      })
      return
    }
    if (wrongRole) {
      void navigate({ to: homeForRole(user.role), replace: true })
    }
  }, [loading, onSignIn, user, wrongRole, href, navigate])

  if (loading || !user || wrongRole) return <SessionLoading />

  return <>{children}</>
}
