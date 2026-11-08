import { ArrowRight, Clock, ShieldCheck, ShieldAlert } from 'lucide-react'
import { labelToMinute } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Impact } from './form'

/**
 * Ringkasan dampak di atas halaman. Semua angka dihitung dari draf form, jadi
 * admin melihat akibat perubahan sebelum menekan simpan — terutama jumlah blok
 * per hari, yang menentukan seluruh ketersediaan slot.
 *
 * Bila draf berbeda dari nilai tersimpan, nilai baru ditampilkan di samping
 * nilai lama dengan panah, bukan menggantikannya; admin perlu melihat keduanya.
 */
export function OperationsSummary({
  impact,
  saved,
  dirtyCount,
}: {
  impact: Impact
  saved: Impact
  dirtyCount: number
}) {
  return (
    <section
      aria-label='Ringkasan operasional'
      className='overflow-hidden rounded-xl border bg-card shadow-xs'
    >
      <div className='flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3 sm:px-6'>
        <h2 className='text-sm font-semibold'>Berlaku di mesin kuota</h2>
        <p className='text-xs text-muted-foreground'>
          {dirtyCount === 0
            ? 'Sesuai pengaturan tersimpan'
            : `${dirtyCount} seksi diubah, belum disimpan`}
        </p>
      </div>

      <div className='grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0'>
        <Stat label='Jam operasional' value={saved.hours} next={impact.hours} />
        <Stat label='Blok per hari' value={saved.blocks} next={impact.blocks} />
        <Stat label='Masa tenggang' value={saved.grace} next={impact.grace} />
        <Stat label='Jendela pesan' value={saved.window} next={impact.window} />
        <Stat
          label='Persetujuan'
          value={saved.approval}
          next={impact.approval}
          className='col-span-2 sm:col-span-1'
        />
      </div>

      <DayTimeline
        open={impact.hours.split('–')[0] ?? ''}
        close={impact.hours.split('–')[1] ?? ''}
        blocks={impact.blocks}
      />
    </section>
  )
}

function Stat({
  label,
  value,
  next,
  className,
}: {
  label: string
  value: string
  next: string
  className?: string
}) {
  const changed = next !== value

  return (
    <div className={cn('min-w-0 px-5 py-4 sm:px-6', className)}>
      <p className='truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        {label}
      </p>
      <p className='mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5'>
        <span
          className={cn(
            'text-xl leading-none font-semibold tabular-nums',
            changed && 'text-muted-foreground line-through decoration-1'
          )}
        >
          {value}
        </span>
        {changed && (
          <span className='flex items-baseline gap-1 text-xl leading-none font-semibold text-primary tabular-nums'>
            <ArrowRight className='size-3.5 shrink-0 self-center' aria-hidden />
            {next}
            <span className='sr-only'>belum disimpan</span>
          </span>
        )}
      </p>
    </div>
  )
}

/**
 * Pita 24 jam: jendela operasional disorot, tiap blok digambar sebagai satu
 * pemisah. Ini pengganti kalimat "12 blok 30 menit per hari" — bentuk jamnya
 * langsung terbaca, dan perubahan satuan blok terlihat tanpa menghitung.
 */
function DayTimeline({
  open,
  close,
  blocks,
}: {
  open: string
  close: string
  blocks: string
}) {
  const start = open ? labelToMinute(open) : Number.NaN
  const end = close ? labelToMinute(close) : Number.NaN
  const valid =
    Number.isFinite(start) && Number.isFinite(end) && end > start && end <= 1440
  const count = Number.parseInt(blocks, 10) || 0

  return (
    <div className='border-t px-5 py-4 sm:px-6'>
      <div className='mb-2 flex items-baseline justify-between gap-2 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1.5'>
          <Clock className='size-3.5' aria-hidden />
          {valid ? `${open} sampai ${close}` : 'Rentang jam belum valid'}
        </span>
        <span className='tabular-nums'>
          {count > 0 ? `${count} blok terisi` : 'Tidak ada blok'}
        </span>
      </div>

      <div
        className='relative h-9 overflow-hidden rounded-md bg-muted/70'
        role='img'
        aria-label={
          valid
            ? `Jendela operasional ${open} sampai ${close}, ${count} blok`
            : 'Jendela operasional belum valid'
        }
      >
        {valid && (
          <div
            className='absolute inset-y-0 bg-primary/15 transition-[inset-inline-start,width] duration-300 ease-out motion-reduce:transition-none'
            style={{
              insetInlineStart: `${(start / 1440) * 100}%`,
              width: `${((end - start) / 1440) * 100}%`,
            }}
          >
            <div className='flex h-full'>
              {Array.from({ length: Math.max(0, count) }, (_, index) => (
                <span
                  key={index}
                  className='h-full flex-1 border-e border-primary/25 last:border-e-0'
                />
              ))}
            </div>
          </div>
        )}
        {[0, 6, 12, 18, 24].map((hour) => (
          <span
            key={hour}
            aria-hidden
            className='absolute top-0 h-full border-s border-border first:border-s-0'
            style={{ insetInlineStart: `${(hour / 24) * 100}%` }}
          />
        ))}
      </div>
      <div className='mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums'>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  )
}

/** Penanda kecil untuk seksi yang keputusannya berdampak luas. */
export function PolicyFlag({ manual }: { manual: boolean }) {
  if (!manual) {
    return (
      <span className='inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400'>
        <ShieldCheck className='size-3.5' aria-hidden />
        Booking langsung sah
      </span>
    )
  }
  return (
    <span className='inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400'>
      <ShieldAlert className='size-3.5' aria-hidden />
      Sebagian booking menunggu admin
    </span>
  )
}
