import type { TicketDesign } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { TicketCard } from '@/features/ticket/ticket-card'
import {
  TICKET_DESIGN_DESCRIPTION,
  TICKET_DESIGN_GROUP,
  TICKET_DESIGN_LABEL,
  TICKET_DESIGNS,
  TICKET_PALETTE,
  ticketCssVars,
} from '@/features/ticket/ticket-design'
import { sampleTicketModel } from '@/features/ticket/ticket-model'

/**
 * Pemilih desain tiket: delapan pilihan dalam dua kelompok, satu pratinjau besar.
 *
 * Dikelompokkan karena delapan kartu berderet jadi satu dinding yang tidak
 * terbaca. Tiga pertama adalah tampilan standar; lima sisanya menjawab kondisi
 * tertentu (cetak thermal, QR gagal, gerbang malam, tiket disobek, warna merek),
 * jadi keterangannya menyebut kondisi itu, bukan gaya visualnya.
 *
 * Pratinjau memakai `TicketCard` yang sama dengan yang dilihat supir, bukan
 * gambar statis — jadi yang dipilih Admin di sini persis yang tercetak dan
 * terunduh, termasuk panjang nama customer dan nama aplikasi miliknya sendiri.
 *
 * Pilihannya memakai radio asli di dalam `fieldset` supaya kelompok ini
 * terbaca sebagai satu pertanyaan oleh pembaca layar dan panah keyboard bekerja
 * tanpa penanganan tambahan.
 */
export function TicketDesignPicker({
  value,
  onChange,
  appName,
  logoUrl,
  brandColor,
}: {
  value: TicketDesign
  onChange: (design: TicketDesign) => void
  appName: string
  logoUrl: string | null
  /** Warna merek halaman masuk; hanya berpengaruh pada desain BRAND. */
  brandColor?: string | null
}) {
  const t = useT()
  const sample = sampleTicketModel(t, appName)
  const groups = [
    { key: 'standard' as const, label: t('settings.ticket.groupStandard') },
    { key: 'special' as const, label: t('settings.ticket.groupSpecial') },
  ]

  return (
    <div className='space-y-5'>
      <fieldset className='space-y-4'>
        <legend className='sr-only'>{t('settings.ticket.legend')}</legend>

        {groups.map((group) => (
          <div key={group.key} className='space-y-2'>
            <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
              {group.label}
            </p>
            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
              {TICKET_DESIGNS.filter(
                (design) => TICKET_DESIGN_GROUP[design] === group.key
              ).map((design) => {
                const selected = design === value
                return (
                  <label
                    key={design}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors duration-150',
                      'focus-within:ring-[3px] focus-within:ring-ring/50',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-foreground/25'
                    )}
                  >
                    <input
                      type='radio'
                      name='ticket-design'
                      value={design}
                      checked={selected}
                      onChange={() => onChange(design)}
                      className='mt-0.5 size-4 shrink-0 accent-primary'
                    />
                    <span className='min-w-0'>
                      <span className='flex items-center gap-2'>
                        <DesignThumb design={design} brandColor={brandColor} />
                        <span className='text-sm font-medium'>
                          {t(TICKET_DESIGN_LABEL[design])}
                        </span>
                      </span>
                      <span className='mt-1 block text-xs text-muted-foreground'>
                        {t(TICKET_DESIGN_DESCRIPTION[design])}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <div className='rounded-lg border border-dashed px-3 py-4'>
        <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
          {t('settings.ticket.preview')}
        </p>
        {/* Data contoh, bukan booking asli: pratinjau tetap terlihat walau
            belum ada satu pun booking. */}
        {/* Dipatok 360 px dan boleh digeser mendatar: kartu yang menyusut di
            layar sempit akan membungkus teks dan terpotong oleh tinggi tetap
            482 px — pratinjau lalu tidak lagi mewakili hasil unduhan. */}
        <div className='mt-3 overflow-x-auto'>
          <div className='w-[360px]'>
            <TicketCard
              model={sample}
              design={value}
              logoUrl={logoUrl}
              brandColor={brandColor}
              label={t('settings.ticket.preview')}
            />
          </div>
        </div>
        <p className='mt-3 text-xs text-muted-foreground'>
          {t('settings.ticket.previewNote')}
        </p>
      </div>
    </div>
  )
}

/**
 * Penanda mini supaya pilihan bisa dibedakan sebelum pratinjau dibaca: bentuk
 * besarnya yang ditiru (rel, pita gelap, stub, QR di kiri), bukan detailnya.
 * Warna diambil dari palet tiket supaya penanda tidak pernah berbeda warna
 * dengan kartu sungguhan.
 */
function DesignThumb({
  design,
  brandColor,
}: {
  design: TicketDesign
  brandColor?: string | null
}) {
  const p = TICKET_PALETTE

  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-6 shrink-0 flex-col overflow-hidden rounded-[3px] border border-[var(--tk-line)]',
        design === 'NIGHT' ? 'bg-[var(--tk-night)]' : 'bg-white'
      )}
      style={ticketCssVars(design, brandColor)}
    >
      {design === 'CLASSIC' && (
        <>
          <span
            className='mx-1 mt-1 h-0.5 w-2.5'
            style={{ background: p.accent }}
          />
          <span
            className='mx-auto mt-1 size-3.5'
            style={{ background: p.ink }}
          />
          <span className='mt-1 h-2 w-full' style={{ background: p.tint }} />
        </>
      )}

      {design === 'MINIMAL' && (
        <>
          <span className='h-1 w-full' style={{ background: p.accent }} />
          <span className='mt-1 flex gap-0.5 px-1'>
            <span className='size-3' style={{ background: p.ink }} />
            <span className='flex-1 space-y-0.5 pt-0.5'>
              <span
                className='block h-1 rounded-sm'
                style={{ background: p.ink }}
              />
              <span
                className='block h-1 rounded-sm'
                style={{ background: p.accent }}
              />
            </span>
          </span>
        </>
      )}

      {design === 'NAVY' && (
        <>
          <span className='h-3 w-full' style={{ background: p.navy }} />
          <span
            className='mx-auto -mt-1.5 size-4 rounded-[2px] border bg-white'
            style={{ borderColor: p.line }}
          />
        </>
      )}

      {design === 'THERMAL' && (
        <>
          <span className='h-[2px] w-full' style={{ background: p.monoInk }} />
          <span
            className='mx-auto mt-1 size-3.5'
            style={{ background: p.monoInk }}
          />
          <span
            className='mx-1 mt-1 h-px'
            style={{ background: p.monoInk }}
          />
          <span
            className='mx-1 mt-1 h-px'
            style={{ background: p.monoMuted }}
          />
        </>
      )}

      {design === 'LARGE_CODE' && (
        <>
          <span className='flex flex-1'>
            <span className='h-full w-1' style={{ background: p.accent }} />
            <span className='flex-1 space-y-1 p-1'>
              <span
                className='block h-2.5 w-full'
                style={{ background: p.ink }}
              />
              <span
                className='block h-1.5 w-full'
                style={{ background: p.ink }}
              />
            </span>
          </span>
        </>
      )}

      {design === 'NIGHT' && (
        <>
          <span
            className='mx-auto mt-1 size-3.5 rounded-[2px] bg-white'
            style={{ outline: `2px solid ${p.night}` }}
          />
          <span
            className='mx-auto mt-1 h-1 w-3.5 rounded-sm'
            style={{ background: p.nightInk }}
          />
          <span
            className='mx-1 mt-1 h-px'
            style={{ background: p.nightLine }}
          />
        </>
      )}

      {design === 'TEAROFF' && (
        <>
          <span
            className='mx-auto mt-1 size-3.5'
            style={{ background: p.ink }}
          />
          <span
            className='mx-0.5 mt-1 border-t border-dashed'
            style={{ borderColor: p.seam }}
          />
          <span className='h-2 w-full' style={{ background: p.stub }} />
        </>
      )}

      {design === 'BRAND' && (
        <>
          <span className='h-3 w-full bg-[var(--tk-band)]' />
          <span
            className='mx-auto -mt-1.5 size-4 rounded-[2px] border bg-white'
            style={{ borderColor: p.line }}
          />
        </>
      )}
    </span>
  )
}
