import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useSetPageTitle } from '@/context/page-title-provider'
import { ForbiddenError } from '@/features/errors/forbidden'
import { GeneralError } from '@/features/errors/general-error'
import { MaintenanceError } from '@/features/errors/maintenance-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { UnauthorisedError } from '@/features/errors/unauthorized-error'

export const Route = createFileRoute('/_authenticated/errors/$error')({
  component: RouteComponent,
})

/** Judul untuk bilah atas mobile; halaman error tidak memakai PageHeader. */
const TITLES: Record<string, string> = {
  unauthorized: 'Tidak Terautentikasi',
  forbidden: 'Akses Ditolak',
  'not-found': 'Halaman Tidak Ditemukan',
  'internal-server-error': 'Terjadi Kesalahan',
  'maintenance-error': 'Dalam Perbaikan',
}

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { error } = Route.useParams()

  const errorMap: Record<string, React.ComponentType> = {
    unauthorized: UnauthorisedError,
    forbidden: ForbiddenError,
    'not-found': NotFoundError,
    'internal-server-error': GeneralError,
    'maintenance-error': MaintenanceError,
  }
  const ErrorComponent = errorMap[error] || NotFoundError

  useSetPageTitle(TITLES[error] ?? 'Halaman Tidak Ditemukan')

  return (
    <>
      {/*
        Di layar sempit bilah ini digantikan MobileNav dari layout: Header punya
        SidebarTrigger sendiri, jadi membiarkannya tampil akan menampilkan dua
        tombol menu bersamaan.
      */}
      <Header fixed className='border-b max-md:hidden'>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <div className='flex-1 [&>div]:h-full'>
        <ErrorComponent />
      </div>
    </>
  )
}
