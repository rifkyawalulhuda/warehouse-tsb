// Entry mandiri untuk preview/screenshot: render dashboard TSB tanpa router file-based.
import { createRoot } from 'react-dom/client'
import { LayoutProvider } from '@/context/layout-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { tsbSidebarData } from '@/components/layout/data/tsb-sidebar-data'
import { Footer } from '@/components/layout/footer'
import { TsbAdminDashboard } from './index'
import '@/styles/index.css'

function Preview() {
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

createRoot(document.getElementById('root')!).render(<Preview />)
