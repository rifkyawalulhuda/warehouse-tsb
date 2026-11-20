import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { useT } from '@/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const THEME_OPTIONS = [
  { value: 'light', labelKey: 'theme.light', icon: Sun },
  { value: 'dark', labelKey: 'theme.dark', icon: Moon },
  { value: 'system', labelKey: 'theme.system', icon: Monitor },
] as const

/**
 * Pemilih tema di kaki sidebar. Memakai tombol lebar penuh (bukan ikon kecil di
 * header) supaya mode terang mudah ditemukan, dan labelnya terbaca dalam bahasa
 * Indonesia.
 */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const { isMobile } = useSidebar()
  const t = useT()
  const current =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[2]
  const CurrentIcon = current.icon

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='sm'
              tooltip={t('theme.label')}
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <CurrentIcon />
              <span className='truncate'>
                {t('theme.current', { theme: t(current.labelKey) })}
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-48 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
              {t('theme.appearance')}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {THEME_OPTIONS.map(({ value, labelKey, icon: Icon }) => (
              <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                <Icon />
                {t(labelKey)}
                <Check
                  size={14}
                  className={cn('ms-auto', theme !== value && 'hidden')}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
