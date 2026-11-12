import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { updateUser } from '@/lib/api/endpoints'
import type { ManagedUser, Role } from '@/lib/api/types'
import { roleLabels } from '@/lib/format'
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
import { Switch } from '@/components/ui/switch'

/** Peran yang boleh dipilih. Customer sengaja tidak ada: akunnya dibuat dan
 * dipindahkan di Master Data Customer, bukan di halaman ini. */
const EDITABLE_ROLES: Role[] = ['ADMIN', 'GATE_OFFICER', 'CHECKER']

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Form = {
  name: string
  email: string
  phone: string
  role: Role
  password: string
}

function formFrom(user: ManagedUser): Form {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    role: user.role,
    password: '',
  }
}

/**
 * Dialog Ubah untuk akun staf.
 *
 * Dibuka per akun (`key={user.id}` di pemanggil) sehingga isian selalu dimulai
 * dari data terbaru tanpa efek penyelaras state. Password kosong berarti tidak
 * diubah — mengosongkannya karena tidak sengaja tidak boleh mengunci akun.
 */
export function EditUserDialog({
  user,
  open,
  onOpenChange,
  isSelf,
  isLastActiveAdmin,
  withStatus = false,
}: {
  user: ManagedUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSelf: boolean
  isLastActiveAdmin: boolean
  /**
   * Tampilkan sakelar Aktif. Dimatikan untuk layar yang sudah punya kolom Aktif
   * sendiri; tab Master Data Pengguna memakainya karena tidak punya kolom itu.
   */
  withStatus?: boolean
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Form>(() =>
    user
      ? formFrom(user)
      : { name: '', email: '', phone: '', role: 'CHECKER', password: '' }
  )
  const [isActive, setIsActive] = useState(user?.isActive ?? true)

  const save = useMutation({
    mutationFn: (payload: Parameters<typeof updateUser>[1]) =>
      updateUser(user!.id, payload),
    onSuccess: () => {
      toast.success('Data pengguna diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['master', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  if (!user) return null

  // Peran akun sendiri bisa dikunci: server menolak penurunan peran Admin
  // sendiri (CANNOT_DEMOTE_SELF), jadi jangan tawarkan pilihan yang pasti gagal.
  const roleLocked = isSelf || isLastActiveAdmin
  const dirty =
    form.name.trim() !== user.name ||
    form.email.trim().toLowerCase() !== user.email ||
    form.phone.trim() !== (user.phone ?? '') ||
    form.role !== user.role ||
    form.password.length > 0 ||
    (withStatus && isActive !== user.isActive)

  const valid =
    form.name.trim().length >= 2 &&
    EMAIL_PATTERN.test(form.email.trim()) &&
    (form.password.length === 0 || form.password.length >= 7)

  const submit = () => {
    const payload: Parameters<typeof updateUser>[1] = {}
    // Hanya kirim yang berubah agar audit tidak mencatat perubahan palsu.
    if (form.name.trim() !== user.name) payload.name = form.name.trim()
    if (form.email.trim().toLowerCase() !== user.email) {
      payload.email = form.email.trim().toLowerCase()
    }
    if (form.phone.trim() !== (user.phone ?? '')) {
      payload.phone = form.phone.trim() || null
    }
    if (form.role !== user.role) payload.role = form.role
    if (form.password.length > 0) payload.password = form.password
    if (withStatus && isActive !== user.isActive) payload.isActive = isActive
    save.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Ubah pengguna</DialogTitle>
          <DialogDescription>
            Perbarui data akun {user.email}
            {isSelf ? ' (akun Anda sendiri)' : ''}. Kosongkan password bila
            tidak ingin menggantinya.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-3'>
          <div className='space-y-1'>
            <Label htmlFor='edit-name'>Nama</Label>
            <Input
              id='edit-name'
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label htmlFor='edit-email'>Email</Label>
              <Input
                id='edit-email'
                type='email'
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
              <p className='text-xs text-muted-foreground'>
                Email adalah identitas login.
              </p>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='edit-phone'>No. HP</Label>
              <Input
                id='edit-phone'
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </div>
          </div>
          <div className='space-y-1'>
            <Label>Peran</Label>
            <Select
              value={form.role}
              disabled={roleLocked}
              onValueChange={(value) =>
                setForm({ ...form, role: value as Role })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {roleLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleLocked && (
              <p className='text-xs text-muted-foreground'>
                {isSelf
                  ? 'Peran Anda sendiri tidak dapat diubah.'
                  : 'Ini satu-satunya Admin aktif; perannya tidak dapat diturunkan.'}
              </p>
            )}
          </div>
          <div className='space-y-1'>
            <Label htmlFor='edit-password'>Password baru (opsional)</Label>
            <Input
              id='edit-password'
              type='password'
              autoComplete='new-password'
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder='Kosongkan bila tidak diganti'
            />
            {form.password.length > 0 && form.password.length < 7 && (
              <p className='text-xs text-destructive'>Minimal 7 karakter.</p>
            )}
          </div>
          {withStatus && (
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div>
                <p className='text-sm font-medium'>Aktif</p>
                <p className='text-xs text-muted-foreground'>
                  {isActive
                    ? 'Akun ini bisa masuk dan memakai aplikasi.'
                    : 'Akun ini tidak bisa masuk.'}
                </p>
              </div>
              <Switch
                checked={isActive}
                // Menonaktifkan akun sendiri dikunci: hanya Admin yang bisa
                // mengaktifkan kembali, jadi ini akan mengunci sistem.
                disabled={isSelf}
                onCheckedChange={setIsActive}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={!dirty || !valid || save.isPending}
            onClick={submit}
          >
            {save.isPending && <Loader2 className='animate-spin' />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
