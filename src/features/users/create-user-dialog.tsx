import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { createUser } from '@/lib/api/endpoints'
import type { ManagedUser, Role } from '@/lib/api/types'
import { roleLabels } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Akun staf yang boleh dibuat dari sini. Customer sengaja tidak ada: akun
 * customer dibuat bersama perusahaannya di Master Data Customer.
 */
export const STAFF_ROLES: Role[] = ['ADMIN', 'GATE_OFFICER', 'CHECKER']

export function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'CHECKER' as Role,
    password: '',
  })

  const create = useMutation({
    mutationFn: () =>
      createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
        phone: form.phone.trim() || undefined,
      }),
    onSuccess: (user: ManagedUser) => {
      toast.success(t('users.created', { email: user.email }))
      void queryClient.invalidateQueries({ queryKey: ['master', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      setForm({
        name: '',
        email: '',
        phone: '',
        role: 'CHECKER',
        password: '',
      })
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const valid =
    form.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
    form.password.length >= 7

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('users.createTitle')}</DialogTitle>
          <DialogDescription>{t('users.createDesc')}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='new-name'>{t('users.label.name')}</Label>
            <Input
              id='new-name'
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='new-email'>{t('users.label.email')}</Label>
              <Input
                id='new-email'
                type='email'
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </div>
            <div className='space-y-1'>
              <Label htmlFor='new-phone'>{t('users.label.phone')}</Label>
              <Input
                id='new-phone'
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label>{t('users.label.role')}</Label>
            <Select
              value={form.role}
              onValueChange={(value) =>
                setForm({ ...form, role: value as Role })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='new-password'>{t('users.label.initialPassword')}</Label>
            <Input
              id='new-password'
              type='password'
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder={t('users.passwordPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!valid || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className='animate-spin' />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
