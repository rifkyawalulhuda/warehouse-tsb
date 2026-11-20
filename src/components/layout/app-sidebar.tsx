import { useAuthStore } from '@/stores/auth-store'
import { useLayout } from '@/context/layout-provider'
import { usePendingApprovals } from '@/hooks/use-pending-approvals'
import { useT } from '@/lib/i18n'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { buildSidebarData } from './data/sidebar-data'
import { LocaleSwitch } from '@/components/locale-switch'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { ThemeMenu } from './theme-menu'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const user = useAuthStore((state) => state.user)
  const pendingApprovals = usePendingApprovals()
  // Judul menu diterjemahkan saat data dibangun; berlangganan bahasa di sini
  // yang membuat sidebar menggambar ulang begitu bahasa diganti.
  const t = useT()

  const data = buildSidebarData(
    user?.role ?? null,
    {
      name: user?.name ?? t('nav.defaultUser'),
      email: user?.email ?? '',
      company: user?.customerName ?? undefined,
    },
    { pendingApprovals }
  )

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* Saat sidebar menyempit jadi ikon, pengalih bahasa tidak muat;
            pilihannya tetap tersedia di halaman Pengaturan. */}
        <div className='px-1 pb-1 group-data-[collapsible=icon]:hidden'>
          <LocaleSwitch />
        </div>
        <ThemeMenu />
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
