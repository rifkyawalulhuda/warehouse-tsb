import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { revokeOtherSessions } from '@/lib/api/endpoints'
import type { AccountProfile } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPanel } from '@/features/settings/section-panel'

/**
 * Perangkat & sesi.
 *
 * Sengaja hanya menampilkan jumlah, bukan daftar perangkat: tabel sesi tidak
 * menyimpan user-agent, jadi daftar itu hanya bisa berbunyi "perangkat tidak
 * dikenal, 24 Nov 09.12" — keterangan yang tidak menolong siapa pun memutuskan
 * apakah ada penyusup.
 */
export function SessionsSection({ profile }: { profile: AccountProfile }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState(false)

  const revoke = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: (data) => {
      setConfirm(false)
      queryClient.setQueryData<AccountProfile | undefined>(
        ['account'],
        (old) => (old ? { ...old, activeSessions: data.activeSessions } : old)
      )
      toast.success(
        data.revoked > 0
          ? t('account.sessions.revoked', { count: data.revoked })
          : t('account.sessions.revokedNone')
      )
    },
    onError: (error) => {
      setConfirm(false)
      toast.error(apiErrorMessage(error))
    },
  })

  // Sesi ini selalu ikut dihitung, jadi "1" berarti hanya perangkat ini.
  const others = Math.max(0, profile.activeSessions - 1)

  return (
    <SectionPanel
      icon={MonitorSmartphone}
      title={t('account.sessions.title')}
      description={t('account.sessions.description')}
      footerNote={
        others === 0
          ? t('account.sessions.onlyThis')
          : t('account.sessions.revokeHint')
      }
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-sm font-medium'>
          {profile.activeSessions === 1
            ? t('account.sessions.countOne')
            : t('account.sessions.count', { count: profile.activeSessions })}
        </p>
        <Button
          variant='outline'
          size='sm'
          disabled={others === 0 || revoke.isPending}
          onClick={() => setConfirm(true)}
        >
          {t('account.sessions.revoke')}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('account.sessions.confirmTitle')}
        desc={t('account.sessions.confirmBody')}
        confirmText={t('account.sessions.confirm')}
        cancelBtnText={t('account.sessions.cancel')}
        isLoading={revoke.isPending}
        handleConfirm={() => revoke.mutate()}
      />
    </SectionPanel>
  )
}