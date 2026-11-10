import { useState } from 'react'
import { addYears, format, startOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { dateToISO, formatDate, isoToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type DatePickerProps = {
  /** Tanggal terpilih dalam `YYYY-MM-DD` — format yang dipakai seluruh aplikasi. */
  value?: string
  onChange: (value: string) => void
  /** Batas bawah yang boleh dipilih, `YYYY-MM-DD`. */
  min?: string
  /** Batas atas yang boleh dipilih, `YYYY-MM-DD`. */
  max?: string
  placeholder?: string
  className?: string
  id?: string
  name?: string
  disabled?: boolean
  onBlur?: () => void
  'aria-label'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  ref?: React.Ref<HTMLButtonElement>
}

/**
 * Pemilih tanggal bergaya shadcn: tombol + popover + kalender.
 *
 * Nilainya `YYYY-MM-DD` seperti `<input type="date">` yang digantikannya,
 * supaya pemanggil tidak perlu mengubah state, validasi, atau payload API.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pilih tanggal',
  className,
  id,
  name,
  disabled,
  onBlur,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
  ref,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = value ? isoToDate(value) : undefined
  const minDate = min ? isoToDate(min) : undefined
  const maxDate = max ? isoToDate(max) : undefined

  // Kalender dengan dropdown bulan tidak punya batas sendiri, jadi jendelanya
  // diambil dari batas pemanggil. Tanpa batas, cukup dua tahun ke belakang dan
  // ke depan: rentang operasional tidak pernah lebih lebar dari itu, dan daftar
  // dropdown tetap pendek.
  const anchor = selected ?? maxDate ?? new Date()
  const startMonth = startOfMonth(minDate ?? addYears(anchor, -2))
  const endMonth = startOfMonth(maxDate ?? addYears(anchor, 2))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          name={name}
          type='button'
          variant='outline'
          disabled={disabled}
          onBlur={onBlur}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          data-empty={!selected}
          className={cn(
            'justify-start text-start font-normal data-[empty=true]:text-muted-foreground',
            className
          )}
        >
          <CalendarIcon data-icon='inline-start' />
          {value ? formatDate(value) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          locale={localeId}
          captionLayout='dropdown'
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={selected}
          selected={selected}
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          // Nama bulan di dropdown diambil dari formatter ini; formatter bawaan
          // Calendar memakai locale peramban, bukan `locale` yang diberikan.
          formatters={{
            formatMonthDropdown: (date) =>
              format(date, 'MMM', { locale: localeId }),
          }}
          // Label ARIA bawaan DayPicker berbahasa Inggris. Aplikasi ini
          // berbahasa Indonesia, jadi pembaca layar ikut diterjemahkan.
          labels={{
            labelPrevious: () => 'Bulan sebelumnya',
            labelNext: () => 'Bulan berikutnya',
            labelMonthDropdown: () => 'Pilih bulan',
            labelYearDropdown: () => 'Pilih tahun',
            labelWeekday: (date) => format(date, 'EEEE', { locale: localeId }),
            labelDayButton: (date, modifiers) =>
              `${modifiers.today ? 'Hari ini, ' : ''}${format(date, 'PPPP', {
                locale: localeId,
              })}`,
          }}
          autoFocus
          onSelect={(date) => {
            if (!date) return
            onChange(dateToISO(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
