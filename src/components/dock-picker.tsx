import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  dockOptionLabel,
  dockOptionPlace,
  type DockOption,
} from '@/lib/dock-label'

type DockPickerProps<T extends DockOption> = {
  docks: T[]
  onSelect: (dock: T) => void
  /**
   * Dock yang bebas dan melayani aktivitas, tetapi bukan hak customer ini.
   * Ditampilkan redup di kelompok terpisah — disembunyikan total membuat
   * checker menyangka gudang penuh.
   */
  blockedDocks?: T[]
  disabled?: boolean
  placeholder?: string
  /** Nama aksesibel tombol, mis. "Pilih dock untuk TSB-20261111-001". */
  label?: string
  className?: string
  /** Tampilan tombol pemicu; `ghost` untuk aksi sekunder di bawah aksi utama. */
  variant?: 'outline' | 'ghost'
  size?: 'sm' | 'default'
}

/**
 * Pilihan dock yang bisa dicari. Memakai Popover + Command dari shadcn karena
 * daftar dock bisa panjang; `Select` biasa memaksa pengguna menggulir.
 */
export function DockPicker<T extends DockOption>({
  docks,
  onSelect,
  blockedDocks = [],
  disabled,
  placeholder,
  label,
  className,
  variant = 'outline',
  size = 'sm',
}: DockPickerProps<T>) {
  const t = useT()
  const fallback = placeholder ?? t('picker.selectDock')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<T | null>(null)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          role='combobox'
          aria-expanded={open}
          aria-label={
            selected
              ? t('picker.dockLabel', {
                  label: label ?? t('picker.selectDock'),
                  dock: dockOptionLabel(selected),
                })
              : (label ?? fallback)
          }
          title={selected ? dockOptionLabel(selected) : undefined}
          disabled={disabled}
          className={cn(
            'h-8 w-40 justify-between gap-1 font-normal',
            size === 'default' && 'h-11',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className='truncate'>
            {selected ? dockOptionLabel(selected) : fallback}
          </span>
          <ChevronsUpDownIcon data-icon='inline-end' className='opacity-60' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-72 p-0' align='start'>
        <Command>
          <CommandInput placeholder={t('picker.searchDock')} />
          <CommandList>
            <CommandEmpty>{t('picker.noDock')}</CommandEmpty>
            <CommandGroup>
              {docks.map((dock) => {
                const place = dockOptionPlace(dock)
                return (
                  <CommandItem
                    key={dock.id}
                    value={dockOptionLabel(dock)}
                    onSelect={() => {
                      setSelected(dock)
                      setOpen(false)
                      onSelect(dock)
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        'size-4',
                        selected?.id === dock.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='flex min-w-0 flex-col'>
                      <span className='truncate font-medium'>{dock.dockCode}</span>
                      {place && (
                        <span className='truncate text-xs text-muted-foreground'>
                          {place}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {blockedDocks.length > 0 && (
              <CommandGroup
                heading={t('picker.blockedWarehouseGroup')}
                aria-label={t('picker.blockedWarehouseGroup')}
              >
                {blockedDocks.map((dock) => {
                  const place = dockOptionPlace(dock)
                  return (
                    <CommandItem
                      key={dock.id}
                      value={dockOptionLabel(dock)}
                      // `disabled` milik cmdk, bukan atribut aria biasa:
                      // hanya ini yang membuat pembaca layar dan navigasi
                      // panah memperlakukannya sebagai tidak bisa dipilih.
                      // Alasannya ada di judul kelompok di atasnya.
                      disabled
                    >
                      <span className='size-4' aria-hidden />
                      <span className='flex min-w-0 flex-col'>
                        <span className='truncate font-medium line-through'>
                          {dock.dockCode}
                        </span>
                        {place && (
                          <span className='truncate text-xs text-muted-foreground'>
                            {place}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
