import { ThemeSwitch } from '@/components/theme-switch'
import { brandInitial, tabTitle, useBranding } from '@/lib/branding'
import { useDocumentTitle } from '@/lib/use-document-title'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const brand = useBranding()
  // Judul tab ikut nama aplikasi; halaman masuk sering dibuka dari tautan
  // kiriman, dan tab itu ikut tampil di riwayat peramban.
  useDocumentTitle(tabTitle(brand.appName, brand.appShortName))

  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='absolute end-4 top-4'>
        <ThemeSwitch />
      </div>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <div className='flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <span className='text-lg font-bold'>
              {brandInitial(brand.appName)}
            </span>
          </div>
          <div className='grid text-start leading-tight'>
            <h1 className='text-xl font-semibold'>{brand.appName}</h1>
            {brand.appTagline && (
              <span className='text-xs text-muted-foreground'>
                {brand.appTagline}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
