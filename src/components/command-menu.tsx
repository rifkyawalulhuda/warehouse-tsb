import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useAuthStore } from '@/stores/auth-store'
import { useT, type MessageKey } from '@/lib/i18n'
import { buildSidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

const THEME_COMMANDS: { theme: 'light' | 'dark' | 'system'; label: MessageKey; icon: typeof Sun }[] = [
  { theme: 'light', label: 'theme.light', icon: Sun },
  { theme: 'dark', label: 'theme.dark', icon: Moon },
  { theme: 'system', label: 'theme.system', icon: Laptop },
]

export function CommandMenu() {
  const navigate = useNavigate()
  const t = useT()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const role = useAuthStore((state) => state.user?.role ?? null)
  const user = useAuthStore((state) => state.user)
  const sidebarData = buildSidebarData(role, {
    name: user?.name ?? '',
    email: user?.email ?? '',
  })

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('command.placeholder')} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>{t('command.empty')}</CommandEmpty>
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='size-2 text-muted-foreground/80' />
                    </div>
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading={t('theme.label')}>
            {THEME_COMMANDS.map(({ theme, label, icon: Icon }) => (
              <CommandItem
                key={theme}
                onSelect={() => runCommand(() => setTheme(theme))}
              >
                <Icon /> <span>{t(label)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
