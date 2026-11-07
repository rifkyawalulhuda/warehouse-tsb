import { useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logout } from '@/lib/api/endpoints'
import { useAuthStore } from '@/stores/auth-store'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const reset = useAuthStore((state) => state.reset)

  const handleSignOut = async () => {
    try {
      await logout()
    } catch {
      toast.warning('Sesi lokal dihapus, tetapi server tidak merespons.')
    }
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
      title='Keluar dari akun'
      desc='Anda perlu masuk kembali untuk melanjutkan. Lanjutkan keluar?'
      confirmText='Keluar'
      cancelBtnText='Batal'
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
