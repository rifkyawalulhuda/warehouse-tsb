import { useState } from 'react'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type DockOption = {
  id: number
  dockCode: string
  areaName?: string | null
}

type DockPickerProps<T extends DockOption> = {
  docks: T[]
  onSelect: (dock: T) => void
  disabled?: boolean
  placeholder?: string
  /** Nama aksesibel tombol, mis. "Pilih dock untuk TSB-20261111-001". */
  label?: string
  className?: string
}

/**
 * Pilihan dock yang bisa dicari. Memakai Popover + Command dari shadcn karena
 * daftar dock bisa panjang; `Select` biasa memaksa pengguna menggulir.
 */
export function DockPicker<T extends DockOption>({
  docks,
  onSelect,
  disabled,
  placeholder = 'Pilih dock',
  label,
  className,
}: DockPickerProps<T>) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<T | null>(null)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-label={label ?? placeholder}
          disabled={disabled}
          className={cn(
            'h-8 w-36 justify-between gap-1 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className='truncate'>{selected?.dockCode ?? placeholder}</span>
          <ChevronsUpDownIcon data-icon='inline-end' className='opacity-60' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-60 p-0' align='start'>
        <Command>
          <CommandInput placeholder='Cari kode dock…' />
          <CommandList>
            <CommandEmpty>Tidak ada dock yang cocok.</CommandEmpty>
            <CommandGroup>
              {docks.map((dock) => (
                <CommandItem
                  key={dock.id}
                  value={`${dock.dockCode} ${dock.areaName ?? ''}`}
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
                  <span className='truncate'>{dock.dockCode}</span>
                  {dock.areaName && (
                    <span className='ms-auto truncate text-xs text-muted-foreground'>
                      {dock.areaName}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

