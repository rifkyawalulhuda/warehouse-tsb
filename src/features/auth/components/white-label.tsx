import { BrandLogo } from '@/components/brand-logo'
import { useBranding } from '@/lib/branding'
import { cn } from '@/lib/utils'

/**
 * Sisi kanan halaman masuk.
 *
 * Isinya diatur Admin di Pengaturan: gambar unggahan, warna aksen, atau
 * keduanya. Yang tampil selalu sekadar merek — tidak ada data operasional, dan
 * tidak ada instruksi masuk, karena instruksi itu sudah ada di samping formulir.
 *
 * Bila belum ada gambar maupun warna, panel memakai gradien bawaan tema supaya
 * halaman tidak pernah tampak kosong atau rusak.
 */
export function WhiteLabel({ className }: { className?: string }) {
  const brand = useBranding()
  const { loginCoverUrl, loginBrandColor } = brand

  // Hanya tampil di layar besar: di ponsel tempatnya lebih berharga untuk
  // formulir, dan gambar penuh layar hanya menambah gulir.
  return (
    <div
      className={cn(
        'relative hidden overflow-hidden lg:block',
        !loginCoverUrl && !loginBrandColor && 'bg-muted',
        className
      )}
      style={
        loginCoverUrl
          ? {
              backgroundImage: `url("${loginCoverUrl}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : loginBrandColor
            ? { backgroundColor: loginBrandColor }
            : undefined
      }
    >
      {/* Lapisan warna semi transparan: gambar apa pun harus tetap bisa ditumpangi
          teks merek berwarna putih tanpa bergantung pada kecerahan fotonya. */}
      <div
        className='absolute inset-0'
        style={
          loginCoverUrl
            ? {
                backgroundImage: `linear-gradient(to top right, ${
                  loginBrandColor ?? '#0f172a'
                }dd, #0f172a22)`,
              }
            : loginBrandColor
              ? {
                  backgroundImage:
                    'linear-gradient(to top right, #0f172a55, #0f172a11)',
                }
              : {
                  backgroundImage:
                    'linear-gradient(to top right, var(--primary)22, transparent 70%)',
                }
        }
        aria-hidden='true'
      />

      <div
        className={cn(
          'relative flex h-full flex-col justify-between p-10 xl:p-14',
          loginCoverUrl || loginBrandColor ? 'text-white' : 'text-foreground'
        )}
      >
        <div className='flex items-center gap-3'>
          {/* Logo unggahan bisa berwarna gelap; di atas foto atau warna aksen
              ia diberi alas putih supaya tetap terbaca. Lencana huruf sudah
              punya alas sendiri. */}
          {brand.appLogoUrl && (loginCoverUrl || loginBrandColor) ? (
            <span className='flex items-center justify-center rounded-xl bg-white/95 px-2 py-1.5 shadow-sm'>
              <BrandLogo
                name={brand.appName}
                logoUrl={brand.appLogoUrl}
                size={26}
              />
            </span>
          ) : (
            <BrandLogo
              name={brand.appName}
              logoUrl={brand.appLogoUrl}
              size={40}
              className={cn(
                !brand.appLogoUrl &&
                  (loginCoverUrl || loginBrandColor) &&
                  'bg-white/15 text-white backdrop-blur-sm'
              )}
            />
          )}
          <span className='text-sm font-semibold tracking-tight'>
            {brand.appName}
          </span>
        </div>

        <div className='max-w-md'>
          <p className='text-3xl font-semibold tracking-tight text-balance xl:text-4xl'>
            {brand.appTagline || brand.appName}
          </p>
          <p
            className={cn(
              'mt-3 text-sm text-pretty',
              loginCoverUrl || loginBrandColor
                ? 'text-white/80'
                : 'text-muted-foreground'
            )}
          >
            {brand.loginDescription}
          </p>
        </div>

        <p
          className={cn(
            'text-xs',
            loginCoverUrl || loginBrandColor
              ? 'text-white/70'
              : 'text-muted-foreground'
          )}
        >
          © {new Date().getFullYear()} {brand.appName}
        </p>
      </div>
    </div>
  )
}
