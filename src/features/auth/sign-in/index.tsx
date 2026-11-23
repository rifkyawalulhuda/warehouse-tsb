import { useSearch } from '@tanstack/react-router'
import { BrandLogo } from '@/components/brand-logo'
import { CapsDiagnostic } from '@/dev/caps-diagnostic'
import { useBranding, tabTitle } from '@/lib/branding'
import { useDocumentTitle } from '@/lib/use-document-title'
import { useFavicon } from '@/lib/use-favicon'
import { useT } from '@/lib/i18n'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const brand = useBranding()
  const t = useT()
  useDocumentTitle(tabTitle(brand.appName, brand.appShortName))
  useFavicon(brand.appLogoUrl)

  return (
    <AuthLayout>
      {/* Logo dan formulir berada di satu sumbu: tanpa kartu, kedalaman tidak
          berpindah-pindah seperti merek di atas bingkai dan isi di dalamnya. */}
      <div className='mb-6 flex items-center gap-3'>
        <BrandLogo name={brand.appName} logoUrl={brand.appLogoUrl} size={44} />
        <div className='grid leading-tight'>
          <span className='font-semibold tracking-tight'>{brand.appName}</span>
          {brand.appTagline && (
            <span className='text-xs text-muted-foreground'>
              {brand.appTagline}
            </span>
          )}
        </div>
      </div>

      {/* Di layar lebar paragraf ini sudah ada di panel kanan; menampilkannya
          lagi di sini hanya mengulang kalimat yang sama pada satu layar. */}
      {brand.loginDescription && (
        <p className='mb-6 text-sm text-pretty text-muted-foreground lg:hidden'>
          {brand.loginDescription}
        </p>
      )}

      <h1 className='text-2xl font-semibold tracking-tight'>
        {t('auth.title')}
      </h1>
      <p className='mt-1.5 mb-6 text-sm text-muted-foreground'>
        {t('auth.subtitle')}
      </p>

      <UserAuthForm redirectTo={redirect} />

      <p className='mt-6 text-xs text-muted-foreground'>
        {t('auth.noAccount')}
      </p>

      {/* Sementara: diagnosis Caps Lock. Lihat src/dev/caps-diagnostic.tsx. */}
      {import.meta.env.DEV &&
        new URLSearchParams(window.location.search).has('capsdiag') && (
          <CapsDiagnostic />
        )}
    </AuthLayout>
  )
}
