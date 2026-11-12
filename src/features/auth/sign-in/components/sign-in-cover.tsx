import { cn } from '@/lib/utils'

/**
 * Isi panel samping di halaman masuk: gambar penutup dan/atau warna permukaan
 * yang diatur Admin.
 *
 * Panel ini memang tidak berisi instruksi. Teks instruksi di halaman masuk
 * akan selalu tertinggal setiap kali alur kerja berubah, dan Admin harus bisa
 * mengganti wajah halaman masuk tanpa minta bantuan pengembang.
 *
 * Di layar sempit panel tidak ditampilkan sama sekali (`hidden lg:block`),
 * sehingga formulir tetap yang pertama terlihat dan tidak ada gambar besar
 * yang menunda masuknya halaman di jaringan lambat.
 */
export function SignInCoverPanel({
  imageUrl,
  color,
  className,
}: {
  imageUrl: string | null
  /** Warna heksadesimal permukaan, sudah divalidasi Admin. */
  color: string | null
  className?: string
}) {
  // Tanpa gambar dan tanpa warna tidak ada yang layak ditampilkan: kolom kosong
  // di sisi kanan hanya membuat formulir tampak tidak seimbang.
  if (!imageUrl && !color) return null

  return (
    <div
      data-slot='sign-in-cover'
      className={cn(
        'relative hidden overflow-hidden rounded-2xl bg-muted lg:block',
        className
      )}
      // inline style karena warnanya berasal dari database, bukan dari tema.
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden='true'
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=''
          className='size-full object-cover'
          // Gambar penutup hanyalah latar: jangan menahan render formulir.
          loading='eager'
          decoding='async'
        />
      )}
    </div>
  )
}
