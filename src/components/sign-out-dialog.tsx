import { useNavigate, useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logout } from '@/lib/api/endpoints'
import { useT } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'
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
