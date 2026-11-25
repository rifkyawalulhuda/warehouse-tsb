import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { updateAccountEmail } from '@/lib/api/endpoints'
import type { AccountProfile } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { PasswordInput } from '@/components/password-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionPanel } from '@/features/settings/section-panel'
import { emailProblem, type EmailProblem } from './form'

const PROBLEM_KEY = {
  invalid: 'account.email.invalid',
  same: 'account.email.same',
  mismatch: 'account.email.mismatch',
  passwordMissing: 'account.email.passwordMissing',
} as const

/**
 * Ganti email.
 *
 * Email diminta dua kali dan disertai kata sandi saat ini. Bukan formalitas:
 * tanpa verifikasi ulang, cookie sesi yang dicuri cukup untuk mengalihkan
 * identitas masuk ke alamat penyerang, dan pemilik akun kehilangan aksesnya
 * sendiri tanpa tahu sebabnya.
 */
export function EmailSection({ profile }: { profile: AccountProfile }) {
  const t = useT()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [repeat, setRepeat] = useState('')
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const dirty = email.length > 0 || repeat.length > 0 || password.length > 0

  const save = useMutation({
    mutationFn: () =>
      updateAccountEmail({ email: email.trim(), currentPassword: password }),
    onSuccess: (data) => {
      queryClient.setQueryData(['account'], data)
      setEmail('')
      setRepeat('')
      setPassword('')
      setProblem(null)
      toast.success(t('account.email.saved'))
    },
    onError: (error) => setProblem(apiErrorMessage(error)),
  })

  function handleSave() {
    const found: EmailProblem | null = emailProblem(
      { email, repeat, password },
      profile.email
    )
    if (found) {
      setProblem(t(PROBLEM_KEY[found]))
      return
    }
    setProblem(null)
    save.mutate()
  }

  return (
    <SectionPanel
      icon={AtSign}
      title={t('account.email.title')}
      description={t('account.email.description')}
      error={problem}
      dirty={dirty}
      pending={save.isPending}
      onSave={handleSave}
      onReset={() => {
        setEmail('')
        setRepeat('')
        setPassword('')
        setProblem(null)
      }}
    >
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label htmlFor='account-email-current'>
            {t('account.email.current')}
          </Label>
          {/* Email sekarang hanya dibaca. Menjadikannya kolom yang bisa diedit
              membuat orang mengira ia sedang mengganti email padahal sedang
              menyalinnya — jadi `readOnly`, bukan `disabled`: isinya harus
              tetap bisa dipilih dan disalin. */}
          <Input
            id='account-email-current'
            value={profile.email}
            readOnly
            className='max-w-md bg-muted/40 font-mono text-sm'
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='account-email-new'>{t('account.email.new')}</Label>
            <Input
              id='account-email-new'
              type='email'
              inputMode='email'
              autoComplete='email'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={problem !== null || undefined}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='account-email-repeat'>
              {t('account.email.repeat')}
            </Label>
            <Input
              id='account-email-repeat'
              type='email'
              inputMode='email'
              autoComplete='off'
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              aria-invalid={problem !== null || undefined}
            />
          </div>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='account-email-password'>
            {t('account.email.password')}
          </Label>
          <PasswordInput
            id='account-email-password'
            autoComplete='current-password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby='account-email-password-hint'
            className='max-w-md'
          />
          <p
            id='account-email-password-hint'
            className='text-xs leading-relaxed text-muted-foreground'
          >
            {t('account.email.passwordHint')}
          </p>
        </div>
      </div>
    </SectionPanel>
  )
}