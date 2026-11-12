import { ThemeSwitch } from '@/components/theme-switch'
import { WhiteLabel } from './components/white-label'

type AuthLayoutProps = {
  children: React.ReactNode
}

/**
 * Bingkai halaman sebelum masuk.
 *
 * Di layar lebar: formulir di sisi kiri dengan gradien biru lembut, sisi kanan
 * dipegang `WhiteLabel` (gambar atau warna pilihan Admin). Di ponsel sisi kanan
 * disembunyikan sepenuhnya — gambar setinggi layar di bawah formulir hanya
 * membuat orang menggulir tanpa tujuan.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='relative grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'>
      <div className='relative flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14'>
        {/* Gradien lembut di belakang formulir: memberi kedalaman tanpa
            bingkai, dan berhenti sebelum tepi kiri agar tidak terlihat seperti
            pita warna. */}
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_60%)]'
        />
        <div className='absolute end-4 top-4 z-10 lg:end-6 lg:top-6'>
          <ThemeSwitch />
        </div>
        <div className='relative mx-auto w-full max-w-[22rem]'>{children}</div>
      </div>
      <WhiteLabel />
    </div>
  )
}
