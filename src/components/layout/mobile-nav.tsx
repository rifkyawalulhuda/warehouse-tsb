import { useMemo } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Menu } from 'lucide-react'
import { useRole } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/context/page-title-provider'
import { useCanGoBack } from '@/hooks/use-can-go-back'
import { usePendingApprovals } from '@/hooks/use-pending-approvals'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { ApprovalPulseDot } from '@/components/pending-approval-badge'
import { navGroupsForRole } from './data/sidebar-data'

/**
 * Bilah atas khusus layar sempit: buka menu, kembali, dan judul halaman.
 *
 * Sebelum ini navigasi di mobile praktis tidak bisa dibuka — sheet sidebar-nya
 * sudah ada, tapi pemicunya hanya dipasang di halaman error. Bilah ini
 * menyediakan pemicu itu sekaligus tombol kembali berbasis riwayat.
 */
export function MobileNav() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  const title = usePageTitle()
  const role = useRole()
  const pendingApprovals = usePendingApprovals()

  // Halaman puncak diturunkan dari menu sidebar role ini, bukan dari daftar
  // terpisah: begitu ada tujuan menu baru, halaman itu otomatis ikut dianggap
  // puncak tanpa ada yang perlu ingat memperbarui daftar kedua.
  const isRootPage = useMemo(
    () =>
      navGroupsForRole(role).some((group) =>
        group.items.some((item) => item.url === pathname)
      ),
    [role, pathname]
  )

  // Riwayat dibaca lewat hook yang berlangganan lokasi. Penjaganya penting: di
  // tab yang dibuka langsung dari tautan (WhatsApp, bookmark) tidak ada halaman
  // sebelumnya, dan `back()` di sana akan melempar pengguna keluar aplikasi.
  const canGoBack = useCanGoBack()
  const showBack = !isRootPage && canGoBack

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur',
        'md:hidden'
      )}
    >
      {/*
        Di ponsel menu tertutup, jadi penanda persetujuan di sidebar tidak
        pernah terlihat. Titik merah di tombol ini adalah satu-satunya isyarat
        yang tampak sebelum menu dibuka.
      */}
      <Button
        variant='ghost'
        size='icon'
        className='relative size-11 shrink-0'
        onClick={() => setOpenMobile(true)}
      >
        <Menu className='size-5' aria-hidden />
        {pendingApprovals > 0 && (
          <span className='absolute end-1.5 top-1.5'>
            <ApprovalPulseDot />
          </span>
        )}
        <span className='sr-only'>
          {pendingApprovals > 0
            ? `Buka menu navigasi, ${pendingApprovals} menunggu persetujuan`
            : 'Buka menu navigasi'}
        </span>
      </Button>

      {showBack && (
        <Button
          variant='ghost'
          size='icon'
          className='size-11 shrink-0'
          onClick={() => router.history.back()}
        >
          <ArrowLeft className='size-5' aria-hidden />
          <span className='sr-only'>Kembali ke halaman sebelumnya</span>
        </Button>
      )}

      {/*
        Gema visual dari <h1> halaman, yang di layar sempit disembunyikan secara
        visual oleh PageHeader. Teksnya sama persis dan sudah ada di heading
        halaman, jadi gema ini tidak perlu diumumkan lagi oleh pembaca layar.
      */}
      <span
        aria-hidden
        className='min-w-0 flex-1 truncate px-1 text-sm font-semibold'
      >
        {title}
      </span>
    </header>
  )
}
