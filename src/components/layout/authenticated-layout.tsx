import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { tabTitle, useBranding } from '@/lib/branding'
import { useDocumentTitle } from '@/lib/use-document-title'
import { useFavicon } from '@/lib/use-favicon'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { PageTitleProvider, usePageTitle } from '@/context/page-title-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Footer } from '@/components/layout/footer'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <SearchProvider>
      <PageTitleProvider>
        <LayoutProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />
            <AppSidebar />
            <SidebarInset
              className={cn(
                // Set content container, so we can use container queries
                '@container/content',

                // If layout is fixed, set the height
                // to 100svh to prevent overflow
                'has-data-[layout=fixed]:h-svh',

                // If layout is fixed and sidebar is inset,
                // set the height to 100svh - spacing (total margins) to prevent overflow
                'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
              )}
            >
              <MobileNav />
              <div className='flex min-h-0 flex-1 flex-col'>
                {children ?? <Outlet />}
              </div>
              <Footer />
            </SidebarInset>
            <DocumentTitle />
          </SidebarProvider>
        </LayoutProvider>
      </PageTitleProvider>
    </SearchProvider>
  )
}

/**
 * Judul tab peramban: "Antrean Hari Ini · <aplikasi>". Harus berada di dalam
 * `SidebarProvider` karena memakai React Query lewat `useBranding`, dan di
 * dalam `PageTitleProvider` untuk membaca judul halaman.
 *
 * `useBranding` berbagi cache React Query lewat kunci yang sama dengan sidebar,
 * jadi tidak ada permintaan tambahan saat tata letak ini dipasang.
 */
function DocumentTitle() {
  const pageTitle = usePageTitle()
  const brand = useBranding()
  const app = tabTitle(brand.appName, brand.appShortName)
  useDocumentTitle(pageTitle ? `${pageTitle} · ${app}` : app)
  useFavicon(brand.appLogoUrl)
  return null
}
