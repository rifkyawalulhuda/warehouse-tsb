import { useSearch } from '@tanstack/react-router'
import { brandInitial, useBranding } from '@/lib/branding'
import { useDocumentTitle } from '@/lib/use-document-title'
import { tabTitle } from '@/lib/branding'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const brand = useBranding()
  useDocumentTitle(tabTitle(brand.appName, brand.appShortName))

  return (
    <AuthLayout>
      {/* Logo dan formulir berada di satu sumbu: tanpa kartu, kedalaman tidak
          berpindah-pindah seperti merek di atas bingkai dan isi di dalamnya. */}
      <div className='mb-8 flex items-center gap-3'>
        <div
          className='flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-sm'
          aria-hidden='true'
        >
          {brandInitial(brand.appName)}
        </div>
        <div className='grid leading-tight'>
          <span className='font-semibold tracking-tight'>{brand.appName}</span>
          {brand.appTagline && (
            <span className='text-xs text-muted-foreground'>
              {brand.appTagline}
            </span>
          )}
        </div>
      </div>

      <h1 className='text-2xl font-semibold tracking-tight'>Masuk</h1>
      <p className='mt-1.5 mb-6 text-sm text-muted-foreground'>
        Gunakan email dan password yang diberikan Admin gudang.
      </p>

      <UserAuthForm redirectTo={redirect} />

      <p className='mt-6 text-xs text-muted-foreground'>
        Belum punya akun? Hubungi Admin gudang untuk didaftarkan.
      </p>
    </AuthLayout>
  )
}
