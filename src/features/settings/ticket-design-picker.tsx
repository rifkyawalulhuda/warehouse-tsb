import type { TicketDesign } from '@/lib/api/types'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { TicketCard } from '@/features/ticket/ticket-card'
import {
  TICKET_CSS_VARS,
  TICKET_DESIGN_DESCRIPTION,
  TICKET_DESIGN_LABEL,
  TICKET_DESIGNS,
  TICKET_PALETTE,
} from '@/features/ticket/ticket-design'
import { sampleTicketModel } from '@/features/ticket/ticket-model'

/**
 * Pemilih desain tiket. Tiga pilihan, satu pratinjau besar.
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
}: {
  value: TicketDesign
  onChange: (design: TicketDesign) => void
  appName: string
  logoUrl: string | null
}) {
  const t = useT()
  const sample = sampleTicketModel(t, appName)

  return (
    <div className='space-y-5'>
      <fieldset className='space-y-2'>
        <legend className='sr-only'>{t('settings.ticket.legend')}</legend>

        <div className='grid gap-2 sm:grid-cols-3'>
          {TICKET_DESIGNS.map((design) => {
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
                    <DesignThumb design={design} />
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
      </fieldset>

      <div className='rounded-lg border border-dashed px-3 py-4'>
        <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
          {t('settings.ticket.preview')}
        </p>
        {/* Data contoh, bukan booking asli: pratinjau tetap terlihat walau
            belum ada satu pun booking. */}
        <div className='mt-3'>
          <TicketCard
            model={sample}
            design={value}
            logoUrl={logoUrl}
            label={t('settings.ticket.preview')}
          />
        </div>
        <p className='mt-3 text-xs text-muted-foreground'>
          {t('settings.ticket.previewNote')}
        </p>
      </div>
    </div>
  )
}

/**
 * Penanda mini supaya tiga pilihan bisa dibedakan sebelum pratinjau dibaca:
 * Klasik dengan QR di tengah dan pita tint di bawah, Minimal dengan QR di kiri
 * dan tanggal besar di kanan, Navy dengan pita gelap dan kartu QR menumpuk.
 * Warna diambil dari palet tiket supaya penanda tidak pernah berbeda warna
 * dengan kartu sungguhan.
 */
function DesignThumb({ design }: { design: TicketDesign }) {
  const p = TICKET_PALETTE

  return (
    <span
      aria-hidden
      className='flex h-8 w-6 shrink-0 flex-col overflow-hidden rounded-[3px] border border-[var(--tk-line)] bg-white'
      style={TICKET_CSS_VARS}
    >
      {design === 'CLASSIC' && (
        <>
          <span className='mx-1 mt-1 h-0.5 w-2.5' style={{ background: p.accent }} />
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
              <span className='block h-1 rounded-sm' style={{ background: p.ink }} />
              <span className='block h-1 rounded-sm' style={{ background: p.accent }} />
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
    </span>
  )
}
