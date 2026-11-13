import { brandInitial } from '@/lib/branding'
import { cn } from '@/lib/utils'

type Props = {
  /** Nama aplikasi; dipakai untuk lencana huruf saat logo belum diunggah. */
  name: string
  /** URL logo unggahan Admin; kosong = lencana huruf. */
  logoUrl: string | null
  /** Tinggi logo dalam piksel. Lebar mengikuti rasio aslinya. */
  size?: number
  className?: string
}

/**
 * Logo aplikasi dengan dua bentuk: gambar unggahan Admin, atau lencana huruf
 * pertama nama aplikasi.
 *
 * Tinggi dikunci dan lebar dibiarkan mengikuti rasio gambar. Logo gudang
 * bentuknya macam-macam — ada yang persegi, ada yang wordmark lebar — dan
 * memaksa semuanya ke kotak akan mengecilkan wordmark sampai tidak terbaca.
 * `object-contain` menjaga tidak ada bagian yang terpotong.
 *
 * Gambar diberi `alt=""` karena nama aplikasi selalu ditulis di sebelahnya;
 * pembaca layar tidak perlu mendengar merek dua kali.
 */
export function BrandLogo({ name, logoUrl, size = 40, className }: Props) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=''
        aria-hidden='true'
        style={{ height: size, maxWidth: Math.round(size * 3.5) }}
        className={cn('w-auto shrink-0 object-contain', className)}
      />
    )
  }

  return (
    <div
      aria-hidden='true'
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground shadow-sm',
        className
      )}
    >
      {brandInitial(name)}
    </div>
  )
}
