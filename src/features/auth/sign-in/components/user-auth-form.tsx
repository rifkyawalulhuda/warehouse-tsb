import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { login } from '@/lib/api/endpoints'
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

const formSchema = z.object({
  email: z.email('Masukkan email yang valid.'),
  password: z.string().min(1, 'Masukkan password.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const user = await login(values.email, values.password)
      setUser(user)
      toast.success(`Selamat datang, ${user.name}`)
      navigate({ to: redirectTo || homeForRole(user.role), replace: true })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  // Dimatikan setelah berhasil karena tombol "Masuk" sedang menunggu server:
  // mengganti labelnya di tengah isian akan terlihat seperti form yang
  // kehilangan fokus.
  const submitLabel = isLoading ? 'Memeriksa…' : 'Masuk'

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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  inputMode='email'
                  autoComplete='username'
                  autoCapitalize='none'
                  autoFocus
                  spellCheck={false}
                  placeholder='nama@perusahaan.com'
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
              <FormLabel>Password</FormLabel>
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
