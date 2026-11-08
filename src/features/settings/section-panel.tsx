import type { ReactNode } from 'react'
import { Loader2, RotateCcw, Save, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Satu seksi pengaturan: judul, penjelasan singkat, isi, lalu kaki yang
 * memegang tombol simpan seksi itu sendiri.
 *
 * Tombol simpan sengaja tinggal di kaki seksi, bukan di header halaman: setiap
 * seksi dikirim ke server sebagai permintaan terpisah, jadi satu tombol di
 * header akan membuat admin mengira perubahan yang belum dibuka ikut tersimpan.
 */
export function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
  error,
  dirty,
  pending,
  onSave,
  onReset,
  footerNote,
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  children: ReactNode
  error?: string | null
  dirty?: boolean
  pending?: boolean
  onSave?: () => void
  onReset?: () => void
  footerNote?: ReactNode
}) {
  // Seksi tanpa `onSave` bersifat preferensi lokal (tema): tidak punya status
  // kotor dan tidak pernah menampilkan tombol simpan.
  const savable = typeof onSave === 'function'

  return (
    <section className='overflow-hidden rounded-xl border bg-card shadow-xs'>
      <div className='space-y-1.5 px-5 pt-5 pb-4 sm:px-7 sm:pt-6'>
        <div className='flex items-center gap-2.5'>
          <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
            <Icon className='size-4' aria-hidden />
          </span>
          <h2 className='min-w-0 text-lg font-semibold tracking-tight'>
            {title}
          </h2>
          {savable && dirty && !pending && (
            <span className='ms-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400'>
              <span
                className='size-1.5 rounded-full bg-amber-500'
                aria-hidden
              />
              Belum disimpan
            </span>
          )}
          {pending && (
            <span className='ms-auto flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground'>
              <Loader2 className='size-3.5 animate-spin' aria-hidden />
              Menyimpan
            </span>
          )}
        </div>
        <p className='max-w-prose text-sm leading-relaxed text-muted-foreground'>
          {description}
        </p>
      </div>

      <div className='px-5 pb-5 sm:px-7 sm:pb-6'>
        {/* Isi seksi dibatasi lebarnya supaya label dan kontrol tidak terpisah
            terlalu jauh di layar lebar — jarak 1000px membuat mata kehilangan
            pasangan label ↔ nilainya. */}
        <div className='max-w-3xl'>{children}</div>
      </div>

      {savable && (
        <div className='flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 sm:px-7'>
          <p
            className={cn(
              'max-w-md text-xs leading-snug',
              error ? 'text-destructive' : 'text-muted-foreground'
            )}
            role={error ? 'alert' : undefined}
          >
            {error ??
              footerNote ??
              (dirty
                ? 'Perubahan di seksi ini belum dikirim ke server.'
                : 'Tidak ada perubahan pada seksi ini.')}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={onReset}
              disabled={!dirty || pending}
            >
              <RotateCcw />
              Batalkan
            </Button>
            {/* Saat tidak ada perubahan, tombol simpan turun jadi outline.
                `disabled` saja tidak cukup: di tema gelap warna primary hampir
                putih, dan versi 50%-nya masih terbaca seperti aksi utama yang
                siap ditekan. */}
            <Button
              size='sm'
              variant={dirty ? 'default' : 'outline'}
              onClick={onSave}
              disabled={!dirty || Boolean(error) || pending}
            >
              {pending ? <Loader2 className='animate-spin' /> : <Save />}
              Simpan seksi
            </Button>
          </div>
        </div>
      )}

      {!savable && footerNote && (
        <div className='border-t bg-muted/40 px-5 py-3 text-xs leading-snug text-muted-foreground sm:px-7'>
          {footerNote}
        </div>
      )}
    </section>
  )
}

/**
 * Baris preferensi: label dan penjelasan di kiri, kontrol di kanan. Di layar
 * kecil kontrol turun ke bawah supaya teks penjelasan tetap terbaca utuh.
 */
export function FieldRow({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 border-b py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8',
        className
      )}
    >
      <div className='min-w-0 space-y-1'>
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint && (
          <p className='max-w-md text-xs leading-relaxed text-muted-foreground'>
            {hint}
          </p>
        )}
      </div>
      <div className='sm:shrink-0'>{children}</div>
    </div>
  )
}

/** Input angka dengan satuan sebagai teks di luar kotak, bukan placeholder. */
export function NumberField({
  id,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  width = 'w-20',
}: {
  id: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  step?: number
  unit: string
  width?: string
}) {
  return (
    <div className='flex items-center gap-2'>
      <Input
        id={id}
        type='number'
        inputMode='numeric'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Spinner bawaan browser menimpa angka yang rata kanan pada input
        // sempit seperti ini; di sini ia juga tidak berguna karena besar
        // langkahnya bukan 1 dan admin lebih cepat mengetik langsung.
        className={cn(
          '[appearance:textfield] text-right tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          width
        )}
      />
      <span className='text-sm text-muted-foreground'>{unit}</span>
    </div>
  )
}
