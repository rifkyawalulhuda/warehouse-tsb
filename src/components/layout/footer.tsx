import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useBranding } from '@/lib/branding'

type FooterProps = React.ComponentProps<'footer'>

/**
 * Footer aplikasi: tahun berjalan, nama perusahaan, dan lokasi.
 *
 * Dua baris teksnya bisa diganti Admin di Pengaturan. Isian kosong berarti teks
 * bawaan, dan teks bawaan itu berbeda per bahasa — karena itu pilihan bahasanya
 * dilakukan di sini, bukan di `useBranding()` yang dipakai bersama layar lain.
 * Tahunnya sengaja selalu dihitung, supaya tidak perlu diperbarui tiap Januari.
 */
export function Footer({ className, ...props }: FooterProps) {
  const t = useT()
  const branding = useBranding()
  const company = branding.footerCompany ?? t('footer.company')
  const location = branding.footerLocation ?? t('footer.location')
  // Baris kedua bisa disembunyikan Admin; pemisah "•" ikut hilang bersamanya,
  // kalau tidak footer berakhir dengan bullet menggantung.
  const showLocation = branding.footerShowLocation

  return (
    <footer
      className={cn(
        'text-muted-foreground mt-auto shrink-0 border-t px-4 py-4 text-center text-sm',
        className
      )}
      {...props}
    >
      <span>
        &copy; {new Date().getFullYear()} {company}
      </span>
      {showLocation ? (
        <span className='ms-2 text-muted-foreground/80'>
          &bull; {location}
        </span>
      ) : null}
    </footer>
  )
}