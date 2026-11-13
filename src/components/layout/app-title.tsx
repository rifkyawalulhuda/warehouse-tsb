import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Button } from '../ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { useBranding } from '@/lib/branding'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  const brand = useBranding()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          className='gap-0 py-0 hover:bg-transparent active:bg-transparent'
          asChild
        >
          <div>
            <Link
              to='/'
              onClick={() => setOpenMobile(false)}
              className='flex min-w-0 flex-1 items-center gap-2 text-start text-sm leading-tight'
            >
              <BrandLogo
                name={brand.appName}
                logoUrl={brand.appLogoUrl}
                size={28}
              />
              <span className='grid min-w-0 leading-tight'>
                <span className='truncate font-bold'>{brand.appName}</span>
                {brand.appTagline && (
                  <span className='truncate text-xs'>{brand.appTagline}</span>
                )}
              </span>
            </Link>
            <ToggleSidebar />
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function ToggleSidebar({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar='trigger'
      data-slot='sidebar-trigger'
      variant='ghost'
      size='icon'
      className={cn('aspect-square size-8 max-md:scale-125', className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <X className='md:hidden' />
      <Menu className='max-md:hidden' />
      <span className='sr-only'>Toggle Sidebar</span>
    </Button>
  )
}
