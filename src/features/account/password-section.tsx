import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { updateAccountPassword } from '@/lib/api/endpoints'
import { useT } from '@/lib/i18n'
import { PasswordInput } from '@/components/password-input'
import { Label } from '@/components/ui/label'
import { SectionPanel } from '@/features/settings/section-panel'
import { passwordProblem, type PasswordProblem } from './form'

const PROBLEM_KEY = {
  currentMissing: 'account.password.currentMissing',
  short: 'account.password.tooShort',
  same: 'account.password.same',
  mismatch: 'account.password.mismatch',
} as const

export function PasswordSection() {
  const t = useT()
  const queryClient = useQueryClient()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const dirty = current.length > 0 || next.length > 0 || repeat.length > 0

  const save = useMutation({
    mutationFn: () =>
      updateAccountPassword({
        currentPassword: current,
        newPassword: next,
      }),
    onSuccess: (data) => {
      setCurrent('')
      setNext('')
      setRepeat('')
      setProblem(null)
      // Jumlah sesi aktif berubah karena sesi lain dicabut.
      queryClient.invalidateQueries({ queryKey: ['account'] })
      toast.success(
        data.revoked > 0
          ? t('account.password.savedRevoked', { count: data.revoked })
          : t('account.password.savedNone')
      )
    },
    onError: (error) => setProblem(apiErrorMessage(error)),
  })

  function handleSave() {
    const found: PasswordProblem | null = passwordProblem({ current, next, repeat })
    if (found) {
      setProblem(t(PROBLEM_KEY[found]))
      return
    }
    setProblem(null)
    save.mutate()
  }

  return (
    <SectionPanel
      icon={KeyRound}
      title={t('account.password.title')}
      description={t('account.password.description')}
      error={problem}
      dirty={dirty}
      pending={save.isPending}
      onSave={handleSave}
      onReset={() => {
        setCurrent('')
        setNext('')
        setRepeat('')
        setProblem(null)
      }}
    >
      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label htmlFor='account-password-current'>
            {t('account.password.current')}
          </Label>
          <PasswordInput
            id='account-password-current'
            autoComplete='current-password'
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className='max-w-md'
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='account-password-new'>
              {t('account.password.new')}
            </Label>
            <PasswordInput
              id='account-password-new'
              autoComplete='new-password'
              value={next}
              onChange={(event) => setNext(event.target.value)}
              aria-invalid={problem !== null || undefined}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='account-password-repeat'>
              {t('account.password.repeat')}
            </Label>
            <PasswordInput
              id='account-password-repeat'
              autoComplete='new-password'
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              aria-invalid={problem !== null || undefined}
            />
          </div>
        </div>
      </div>
    </SectionPanel>
  )
}