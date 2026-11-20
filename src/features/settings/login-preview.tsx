import { BrandLogo } from '@/components/brand-logo'
import { useT } from '@/lib/i18n'

type Props = {
  appName: string
  appTagline: string
  appLogoUrl: string
  description: string
}

/**
 * Pratinjau halaman masuk pada ukuran ponsel.
 *
 * Paragraf sambutan dulu hanya ada di panel kanan yang disembunyikan di bawah
 * 1024 px, jadi kalimat itu tidak pernah terlihat di ponsel. Sekarang ia juga
 * tampil di kolom formulir, dan pratinjau ini memperlihatkan persis susunan
 * yang akan dilihat customer: merek, kalimat sambutan, lalu formulir.
 *
 * Bentuknya sengaja tiruan ringan, bukan iframe halaman sungguhan — tujuannya
 * memeriksa panjang teks dan proporsi logo, bukan menguji formulir.
 */
export function LoginPreview({
  appName,
  appTagline,
  appLogoUrl,
  description,
}: Props) {
  const t = useT()
  const name = appName.trim() || '—'
  const text = description.trim() || t('auth.defaultLoginDescription')

  return (
    <div className='mt-4'>
      <p className='mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        {t('settings.login.previewMobile')}
      </p>

      <div className='mx-auto w-full max-w-[17rem] rounded-[1.75rem] border bg-background p-4 shadow-sm'>
        <div className='flex items-center gap-2'>
          <BrandLogo name={name} logoUrl={appLogoUrl.trim() || null} size={28} />
          <div className='grid min-w-0 leading-tight'>
            <span className='truncate text-xs font-semibold'>{name}</span>
            {appTagline.trim() && (
              <span className='truncate text-[10px] text-muted-foreground'>
                {appTagline.trim()}
              </span>
            )}
          </div>
        </div>

        <p className='mt-3 text-[11px] text-pretty text-muted-foreground'>
          {text}
        </p>

        <p className='mt-4 text-sm font-semibold'>{t('settings.login.previewSignIn')}</p>
        <p className='mt-1 text-[10px] text-muted-foreground'>
          {t('settings.login.previewHint')}
        </p>

        <div className='mt-3 space-y-2'>
          <div className='h-8 rounded-md border bg-muted/30' />
          <div className='h-8 rounded-md border bg-muted/30' />
          <div className='h-8 rounded-md bg-primary' />
        </div>
      </div>

      <p className='mt-2 text-center text-[11px] text-muted-foreground'>
        {t('settings.login.previewWide')}
      </p>
    </div>
  )
}
