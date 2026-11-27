import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { logout } from '@/lib/api/endpoints'
import { useT } from '@/lib/i18n'
import { closeSocket } from '@/lib/socket'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const reset = useAuthStore((state) => state.reset)

  const handleSignOut = async () => {
    try {
      await logout()
    } catch {
      toast.warning(t('signOut.warning'))
    }
    // Putuskan socket SEBELUM mengosongkan sesi lokal. Kalau tidak, koneksi
    // tetap memegang room pengguna ini dan (di komputer bersama) penerima
    // berikutnya masih menerima notifikasi booking miliknya sampai server
    // memeriksa ulang identitas 5 menit kemudian.
    closeSocket()
    reset()
    queryClient.clear()
    onOpenChange(false)
    navigate({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true,
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('signOut.title')}
      desc={t('signOut.body')}
      confirmText={t('nav.signOut')}
      cancelBtnText={t('common.cancel')}
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
