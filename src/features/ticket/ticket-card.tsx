import { QRCodeSVG } from 'qrcode.react'
import type { TicketDesign } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import {
  DEFAULT_TICKET_DESIGN,
  TICKET_CSS_VARS,
  TICKET_PALETTE,
} from './ticket-design'
import { splitTicketDate, type TicketModel } from './ticket-model'

/**
 * Kartu tiket yang dilihat supir, dalam tiga tata letak pilihan Admin.
 *
 * Tata letaknya sengaja dipatok (bukan mengalir bebas) karena hasil unduhan PNG
 * menggambar ulang kartu ini di kanvas dengan ukuran yang sama — lihat
 * `ticket-image.ts`. Angka jarak di sini dan di sana harus bergerak bersama,
 * dan `ticket-image.test.ts` menjaga isi ketiga desain.
 *
 * Ketiga desain memuat isi yang sama: delapan nilai (tanggal, jadwal, aktivitas,
 * truk, plat, supir, dock, nomor dokumen) dan QR yang tetap terbaca. Yang
 * berbeda hanya komposisi, jadi mengganti desain tidak pernah menyembunyikan
 * data yang dibutuhkan petugas gate.
 */
export function TicketCard({
  model,
  design = DEFAULT_TICKET_DESIGN,
  logoUrl,
  label,
  className,
}: {
  model: TicketModel
  design?: TicketDesign
  /** Logo aplikasi; kosong berarti hanya nama aplikasi sebagai teks. */
  logoUrl?: string | null
  /** Label aksesibilitas; komponen ini tidak memegang bahasa sendiri. */
  label?: string
  className?: string
}) {
  const logo = logoUrl?.trim() || null
  const shared = { model, logoUrl: logo, className }

  return (
    <Frame model={model} design={design} label={label} className={className}>
      {design === 'MINIMAL' ? (
        <MinimalBody {...shared} />
      ) : design === 'NAVY' ? (
        <NavyBody {...shared} />
      ) : (
        <ClassicBody {...shared} />
      )}
    </Frame>
  )
}

function Frame({
  model,
  design,
  label,
  className,
  children,
}: {
  model: TicketModel
  design: TicketDesign
  label?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <article
      data-ticket-card
      data-ticket-design={design}
      aria-label={label ?? model.code}
      style={TICKET_CSS_VARS}
      className={cn(
        'mx-auto w-full max-w-[360px] overflow-hidden rounded-[18px] bg-white text-[var(--tk-ink)] shadow-lg ring-1 ring-black/5',
        className
      )}
    >
      {children}
    </article>
  )
}

type BodyProps = {
  model: TicketModel
  logoUrl: string | null
  className?: string
}

/** Label kecil di pita atas: nama merek di kiri, jenis dokumen di kanan. */
function BrandRow({
  model,
  logoUrl,
  brandClassName,
  badgeClassName,
  logoBoxClassName,
}: {
  model: TicketModel
  logoUrl: string | null
  brandClassName?: string
  badgeClassName?: string
  logoBoxClassName?: string
}) {
  return (
    <div className='flex h-4 items-center justify-between gap-2 text-[10px] leading-none font-bold tracking-[0.14em] uppercase'>
      <span className={cn('flex min-w-0 items-center gap-1.5', brandClassName)}>
        {logoUrl && <TicketLogo url={logoUrl} className={logoBoxClassName} />}
        <span className='truncate'>{model.appName}</span>
      </span>
      <span className={cn('shrink-0 font-semibold', badgeClassName)}>
        {model.badge}
      </span>
    </div>
  )
}

/**
 * Logo dirender apa adanya tanpa kotak putih, jadi logo berlatar transparan
 * menyatu dengan kartu. Kalau berkasnya gagal dimuat, gambarnya disembunyikan
 * agar yang tampil hanya nama aplikasi — bukan ikon rusak.
 */
function TicketLogo({ url, className }: { url: string; className?: string }) {
  return (
    <img
      src={url}
      alt=''
      aria-hidden
      className={cn('size-4 shrink-0 rounded-[3px] object-contain', className)}
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
    />
  )
}

function Qr({ model, size }: { model: TicketModel; size: number }) {
  return (
    <QRCodeSVG
      value={model.qrToken}
      size={size}
      level='M'
      marginSize={2}
      bgColor={TICKET_PALETTE.white}
      fgColor={TICKET_PALETTE.ink}
    />
  )
}

/** Grid delapan nilai, dua kolom. Dipakai Klasik dan Navy. */
function FieldGrid({
  model,
  className,
}: {
  model: TicketModel
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4', className)}>
      {model.fields.map((field) => (
        <div key={field.label} className='min-w-0 pb-[7px]'>
          <dt className='text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[var(--tk-muted)] uppercase'>
            {field.label}
          </dt>
          <dd className='text-[12.5px] leading-[17px] font-semibold break-words'>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------ Klasik Biru ------------------------------ */

function ClassicBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div className='px-5 pt-4'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-accent)]'
          badgeClassName='text-[var(--tk-badge)]'
        />

        <div className='mt-4 flex justify-center'>
          <Qr model={model} size={162} />
        </div>

        <p className='mt-2 text-center font-mono text-lg leading-[18px] font-bold tracking-[0.06em]'>
          {model.code}
        </p>
        <p className='mt-2 text-center text-[10.5px] leading-[10.5px] text-[var(--tk-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div
        aria-hidden
        className='mt-[14px] h-px w-full'
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, var(--tk-seam) 0 7px, transparent 7px 14px)',
        }}
      />

      <div className='bg-[var(--tk-tint)] px-5 pt-[14px] pb-[10px]'>
        <p className='text-[11px] leading-[11px] font-bold text-[var(--tk-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-[10px]' />

        <p className='mt-2 border-t border-[var(--tk-accent-soft)] pt-2 text-[9.5px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* ----------------------------- Minimal Putih ----------------------------- */

function MinimalBody({ model, logoUrl }: BodyProps) {
  const { day, date } = splitTicketDate(model.date)
  // Enam nilai sisanya; tanggal dan jam sudah jadi sorotan di samping QR.
  const rest = model.fields.slice(2)

  return (
    <>
      <div aria-hidden className='h-1 w-full bg-[var(--tk-accent)]' />

      <div className='px-5 pt-[18px]'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-ink)]'
          badgeClassName='text-[var(--tk-muted)]'
        />

        <div className='mt-[10px] flex items-center gap-4'>
          <div className='shrink-0'>
            <Qr model={model} size={132} />
          </div>
          <div className='min-w-0 flex-1'>
            {day && (
              <p className='text-[10px] leading-[10px] font-semibold tracking-[0.1em] text-[var(--tk-muted)] uppercase'>
                {day}
              </p>
            )}
            <p className='mt-[6px] text-[24px] leading-[24px] font-bold tracking-[-0.02em]'>
              {date}
            </p>
            <p className='mt-1 text-[13px] leading-[13px] font-semibold text-[var(--tk-accent)]'>
              {model.schedule}
            </p>
            <p className='mt-1 font-mono text-[11.5px] leading-[11.5px] font-bold tracking-[0.04em] text-[var(--tk-muted)]'>
              {model.code}
            </p>
          </div>
        </div>

        <p className='mt-[30px] flex items-center gap-1.5 text-[11px] leading-[11px] font-semibold text-[var(--tk-ink)]'>
          <span
            aria-hidden
            className='size-[5px] shrink-0 rounded-full bg-[var(--tk-accent)]'
          />
          {model.instruction}
        </p>

        <dl className='mt-6 grid grid-cols-2 gap-x-4'>
          {rest.map((field) => (
            <div key={field.label} className='min-w-0 pb-[7px]'>
              <dt className='text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[var(--tk-muted)] uppercase'>
                {field.label}
              </dt>
              <dd className='text-[12.5px] leading-[17px] font-semibold break-words'>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          aria-hidden
          className='mt-[14px] border-t border-dashed border-[var(--tk-line)]'
        />

        <p className='mt-3 text-[11.5px] leading-[14px] font-semibold'>
          {model.customer}
        </p>
        <p className='mt-1 text-[10.5px] leading-[13px] text-[var(--tk-muted)]'>
          {model.warehouse}
        </p>

        <p className='mt-[34px] border-t pt-2 pb-5 text-[9.5px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* ------------------------------ Navy Resmi ------------------------------ */

function NavyBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div className='bg-[var(--tk-navy)] px-5 pt-4 pb-[55px] text-white'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-white'
          badgeClassName='text-[var(--tk-navy-badge)]'
          // Logo gelap akan tenggelam di pita navy, jadi diberi alas putih tipis.
          logoBoxClassName='bg-white p-[2px]'
        />

        <p className='mt-[14px] font-mono text-[24px] leading-[24px] font-bold tracking-[0.04em]'>
          {model.code}
        </p>
        <p className='mt-2 text-[10.5px] leading-[13px] text-[var(--tk-navy-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      {/* Kartu putih QR menumpuk ke pita navy — satu-satunya elemen yang
          keluar dari kolomnya, dan sengaja: itu yang membuatnya terbaca
          sebagai pass, bukan sekadar kotak. Tumpukannya 46 px; lebih dalam
          dari itu bayangannya naik menutupi baris customer di atasnya. */}
      <div className='relative mx-auto -mt-[42px] w-[166px] rounded-xl bg-white p-2 shadow-[0_4px_10px_var(--tk-shadow)]'>
        <Qr model={model} size={150} />
      </div>

      <div className='flex flex-1 flex-col px-5 pt-[14px] pb-[13px]'>
        <p className='text-[11px] leading-[11px] font-bold text-[var(--tk-navy)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-3' />

        <p className='mt-[5px] border-t border-[var(--tk-accent-soft)] pt-[6px] text-[9.5px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}
