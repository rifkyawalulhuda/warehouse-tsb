import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { updateProfile } from '@/lib/api/endpoints'
import type { AccountProfile } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth-store'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionPanel } from '@/features/settings/section-panel'
import { profileChanged, profileProblem } from './form'

/**
 * Nama dan nomor HP.
 *
 * Tidak meminta kata sandi: keduanya data tampilan yang tidak bisa dipakai
 * untuk masuk, dan meminta sandi di setiap koreksi ejaan nama membuat orang
 * memilih nama yang salah daripada mengetik sandi lagi.
 */
export function ProfileSection({ profile }: { profile: AccountProfile }) {
  const t = useT()
  const queryClient = useQueryClient()
  const setUser = useAuthStore((state) => state.setUser)

  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [problem, setProblem] = useState<string | null>(null)

  // Isian sengaja TIDAK diselaraskan ulang setiap kali data profil tiba: satu
  // penyegaran latar (mis. sesudah email disimpan) akan menimpa nama yang
  // sedang diketik. Tombol "Batalkan" yang mengembalikannya dari data terbaru.
  const dirty = profileChanged({ name, phone }, profile)

  const save = useMutation({
    mutationFn: () => updateProfile({ name: name.trim(), phone: phone.trim() }),
    onSuccess: (data) => {
      queryClient.setQueryData(['account'], data)
      // Nama tampil di sidebar dan bilah atas, jadi simpanan sesi ikut
      // diperbarui — kalau tidak, sidebar tetap menyebut nama lama sampai
      // halaman dimuat ulang.
      const current = useAuthStore.getState().user
      if (current) setUser({ ...current, name: data.name, phone: data.phone })
      toast.success(t('account.profile.saved'))
    },
    onError: (error) => setProblem(apiErrorMessage(error)),
  })

  function handleSave() {
    const found = profileProblem({ name, phone })
    if (found) {
      setProblem(
        found === 'name'
          ? t('account.profile.nameHint')
          : t('account.profile.phoneHint')
      )
      return
    }
    setProblem(null)
    save.mutate()
  }

  return (
    <SectionPanel
      icon={UserRound}
      title={t('account.profile.title')}
      description={t('account.profile.description')}
      error={problem}
      dirty={dirty}
      pending={save.isPending}
      onSave={handleSave}
      onReset={() => {
        setName(profile.name)
        setPhone(profile.phone ?? '')
        setProblem(null)
      }}
    >
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label htmlFor='account-name'>{t('account.profile.name')}</Label>
          <Input
            id='account-name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete='name'
            maxLength={120}
            aria-invalid={problem !== null || undefined}
            className='max-w-md'
          />
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='account-phone'>{t('account.profile.phone')}</Label>
          <Input
            id='account-phone'
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            // `tel` memunculkan papan angka di HP; `text` di desktop tetap
            // membiarkan tanda + dan spasi seperti nomor yang biasa ditulis.
            type='tel'
            inputMode='tel'
            autoComplete='tel'
            maxLength={24}
            placeholder='08xx xxxx xxxx'
            aria-describedby='account-phone-hint'
            className='max-w-md'
          />
          <p
            id='account-phone-hint'
            className='text-xs leading-relaxed text-muted-foreground'
          >
            {t('account.profile.phoneHint')}
          </p>
        </div>
      </div>
    </SectionPanel>
  )
}