import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { login } from '@/lib/api/endpoints'
import { useT } from '@/lib/i18n'
import { homeForRole, useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

type FormValues = { email: string; password: string }

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const t = useT()

  // Skema disusun di dalam komponen karena pesan galatnya ikut bahasa aktif;
  // skema tingkat modul akan terkunci pada bahasa saat halaman dimuat.
  const formSchema = useMemo(
    () =>
      z.object({
        email: z.email(t('auth.emailInvalid')),
        password: z.string().min(1, t('auth.passwordRequired')),
      }),
    [t]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    setError(null)
    try {
      const user = await login(values.email, values.password)
      setUser(user)
      toast.success(t('auth.welcome', { name: user.name }))
      navigate({ to: redirectTo || homeForRole(user.role), replace: true })
    } catch (cause) {
      // Galat login ditulis di dalam form, bukan hanya sebagai toast: toast
      // hilang sendiri setelah beberapa detik, sementara di sini orang perlu
      // membaca sebabnya sambil memperbaiki isian. Fokus dipindah ke kata
      // sandi karena itu bagian yang paling sering salah ketik.
      setError(apiErrorMessage(cause))
      form.setFocus('password')
    } finally {
      setIsLoading(false)
    }
  }

  // Dimatikan setelah berhasil karena tombol "Masuk" sedang menunggu server:
  // mengganti labelnya di tengah isian akan terlihat seperti form yang
  // kehilangan fokus.
  const submitLabel = isLoading ? t('auth.submitting') : t('auth.submit')

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={`grid gap-4 ${className ?? ''}`}
        // Validasi ditangani zod agar pesan galat konsisten berbahasa Indonesia;
        // tanpa ini browser memblokir submit lebih dulu dengan tooltip bawaannya.
        noValidate
        aria-busy={isLoading}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.email')}</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  inputMode='email'
                  autoComplete='username'
                  autoCapitalize='none'
                  autoFocus
                  spellCheck={false}
                  placeholder={t('auth.emailPlaceholder')}
                  className='h-11'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='current-password'
                  className='[&_input]:h-11'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error && (
          <p
            role='alert'
            className='flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] leading-snug text-destructive'
          >
            <AlertCircle className='mt-0.5 size-4 shrink-0' aria-hidden='true' />
            <span>{error}</span>
          </p>
        )}
        <Button className='mt-1 h-11 w-full' disabled={isLoading}>
          {isLoading ? (
            <Loader2 className='animate-spin' aria-hidden='true' />
          ) : (
            <LogIn aria-hidden='true' />
          )}
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
