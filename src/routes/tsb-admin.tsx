import { createFileRoute } from '@tanstack/react-router'
import { LayoutProvider } from '@/context/layout-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { tsbSidebarData } from '@/components/layout/data/tsb-sidebar-data'
import { Footer } from '@/components/layout/footer'
import { TsbAdminDashboard } from '@/features/tsb-admin'

export const Route = createFileRoute('/tsb-admin')({
  component: TsbAdminRoute,
})

function TsbAdminRoute() {
  return (
    <LayoutProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar data={tsbSidebarData} />
        <SidebarInset className='@container/content'>
          <div className='flex min-h-0 flex-1 flex-col'>
            <TsbAdminDashboard />
          </div>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </LayoutProvider>
  )
}
