import { QRCodeSVG } from 'qrcode.react'
import type { TicketDesign } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import {
  DEFAULT_TICKET_DESIGN,
  TICKET_PALETTE,
  ticketCssVars,
} from './ticket-design'
import { safeLogoUrl } from './logo'
import { splitTicketDate, type TicketModel } from './ticket-model'

/**
 * Kartu tiket yang dilihat supir, dalam delapan tata letak pilihan Admin.
 *
 * Tata letaknya sengaja dipatok (bukan mengalir bebas) karena hasil unduhan PNG
 * menggambar ulang kartu ini di kanvas dengan ukuran yang sama — lihat
 * `ticket-image.ts`. Angka jarak di sini dan di sana harus bergerak bersama,
 * dan `ticket-size.test.tsx` menuntut tinggi kartu sama dengan `TICKET_HEIGHT`.
 *
 * Semua desain memuat isi yang sama: delapan nilai (tanggal, jadwal, aktivitas,
 * truk, plat, supir, dock, nomor dokumen) dan QR yang tetap terbaca. Yang
 * berbeda hanya komposisi, jadi mengganti desain tidak pernah menyembunyikan
 * data yang dibutuhkan petugas gate.
 */
export function TicketCard({
  model,
  design = DEFAULT_TICKET_DESIGN,
  logoUrl,
  brandColor,
  label,
  className,
}: {
  model: TicketModel
  design?: TicketDesign
  /** Logo aplikasi; kosong berarti hanya nama aplikasi sebagai teks. */
  logoUrl?: string | null
  /** Warna merek dari Pengaturan; hanya dipakai desain BRAND. */
  brandColor?: string | null
  /** Label aksesibilitas; komponen ini tidak memegang bahasa sendiri. */
  label?: string
  className?: string
}) {
  // Aturan yang sama dengan kanvas: logo dari luar origin ini tidak ditampilkan,
  // supaya tiket di layar dan tiket yang diunduh selalu sama.
  const shared = { model, logoUrl: safeLogoUrl(logoUrl), className }

  return (
    <Frame
      model={model}
      design={design}
      brandColor={brandColor}
      label={label}
      className={className}
    >
      {design === 'MINIMAL' ? (
        <MinimalBody {...shared} />
      ) : design === 'NAVY' ? (
        <NavyBody {...shared} />
      ) : design === 'THERMAL' ? (
        <ThermalBody {...shared} />
      ) : design === 'LARGE_CODE' ? (
        <LargeCodeBody {...shared} />
      ) : design === 'NIGHT' ? (
        <NightBody {...shared} />
      ) : design === 'TEAROFF' ? (
        <TearoffBody {...shared} />
      ) : design === 'BRAND' ? (
        <BrandBody {...shared} />
      ) : (
        <ClassicBody {...shared} />
      )}
    </Frame>
  )
}

function Frame({
  model,
  design,
  brandColor,
  label,
  className,
  children,
}: {
  model: TicketModel
  design: TicketDesign
  brandColor?: string | null
  label?: string
  className?: string
  children: React.ReactNode
}) {
  const night = design === 'NIGHT'

  return (
    <article
      data-ticket-card
      data-ticket-design={design}
      aria-label={label ?? model.code}
      style={ticketCssVars(design, brandColor)}
      className={cn(
        'relative mx-auto w-full max-w-[360px] overflow-hidden rounded-[18px]',
        night
          ? 'bg-[var(--tk-night)] text-[var(--tk-night-ink)] ring-1 ring-white/10'
          : 'bg-white text-[var(--tk-ink)] shadow-lg ring-1 ring-black/5',
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

/**
 * Grid delapan nilai, dua kolom. Nilainya dipotong satu baris dengan elipsis —
 * sama seperti kanvas — supaya kartu tidak tumbuh dan tinggi DOM tetap cocok
 * dengan PNG. Nilai panjang tetap utuh di halaman detail booking.
 *
 * Varian ditulis sebagai kelas utuh, bukan tumpukan kelas yang ditimpa
 * pemanggil: `tailwind-merge` menyatukan `text-[10px]` dan `text-[var(--tk-*)]`
 * sebagai satu properti, dan hasilnya tinggi baris ikut bergeser — cukup untuk
 * membuat kartu 20 px lebih tinggi dari kanvasnya.
 */
function FieldGrid({
  model,
  className,
  variant = 'default',
}: {
  model: TicketModel
  className?: string
  variant?: 'default' | 'mono' | 'night'
}) {
  const label =
    variant === 'mono'
      ? 'text-[10px] leading-[10px] font-semibold text-[var(--tk-mono-ink)]'
      : variant === 'night'
        ? 'text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[var(--tk-night-muted)]'
        : 'text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[var(--tk-muted)]'
  const value =
    variant === 'mono'
      ? 'text-[var(--tk-mono-ink)]'
      : variant === 'night'
        ? 'text-[var(--tk-night-ink)]'
        : ''

  return (
    <dl className={cn('grid grid-cols-2 gap-x-4', className)}>
      {model.fields.map((field) => (
        <div key={field.label} className='min-w-0 pb-[7px]'>
          <dt className={cn('uppercase', label)}>{field.label}</dt>
          <dd
            className={cn(
              'truncate text-[12.5px] leading-[17px] font-semibold',
              value
            )}
          >
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

        <p className='mt-2 truncate text-center font-mono text-lg leading-[18px] font-bold tracking-[0.06em]'>
          {model.code}
        </p>
        <p className='mt-2 truncate text-center text-[10.5px] leading-[10.5px] text-[var(--tk-muted)]'>
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
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-[10px]' />

        <p className='mt-2 truncate border-t border-[var(--tk-accent-soft)] pt-2 text-[9.5px] text-[var(--tk-muted)]'>
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
              <p className='truncate text-[10px] leading-[10px] font-semibold tracking-[0.1em] text-[var(--tk-muted)] uppercase'>
                {day}
              </p>
            )}
            <p className='mt-[6px] truncate text-[24px] leading-[24px] font-bold tracking-[-0.02em]'>
              {date}
            </p>
            <p className='mt-1 truncate text-[13px] leading-[13px] font-semibold text-[var(--tk-accent)]'>
              {model.schedule}
            </p>
            <p className='mt-1 truncate font-mono text-[11.5px] leading-[11.5px] font-bold tracking-[0.04em] text-[var(--tk-muted)]'>
              {model.code}
            </p>
          </div>
        </div>

        <p className='mt-[30px] flex items-center gap-1.5 text-[11px] leading-[11px] font-semibold text-[var(--tk-ink)]'>
          <span
            aria-hidden
            className='size-[5px] shrink-0 rounded-full bg-[var(--tk-accent)]'
          />
          <span className='truncate'>{model.instruction}</span>
        </p>

        <dl className='mt-6 grid grid-cols-2 gap-x-4'>
          {rest.map((field) => (
            <div key={field.label} className='min-w-0 pb-[7px]'>
              <dt className='text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[var(--tk-muted)] uppercase'>
                {field.label}
              </dt>
              <dd className='truncate text-[12.5px] leading-[17px] font-semibold'>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        <div
          aria-hidden
          className='mt-[14px] border-t border-dashed border-[var(--tk-line)]'
        />

        <p className='mt-3 truncate text-[11.5px] leading-[14px] font-semibold'>
          {model.customer}
        </p>
        <p className='mt-1 truncate text-[10.5px] leading-[13px] text-[var(--tk-muted)]'>
          {model.warehouse}
        </p>

        <p className='mt-[34px] truncate border-t pt-2 pb-5 text-[9.5px] text-[var(--tk-muted)]'>
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

        <p className='mt-[14px] truncate font-mono text-[24px] leading-[24px] font-bold tracking-[0.04em]'>
          {model.code}
        </p>
        <p className='mt-2 truncate text-[10.5px] leading-[13px] text-[var(--tk-navy-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      {/* Kartu putih QR menumpuk ke pita navy — satu-satunya elemen yang
          keluar dari kolomnya, dan sengaja: itu yang membuatnya terbaca
          sebagai pass, bukan sekadar kotak. Tumpukannya 42 px; lebih dalam
          dari itu bayangannya naik menutupi baris customer di atasnya. */}
      <div className='relative mx-auto -mt-[42px] w-[166px] rounded-xl bg-white p-2 shadow-[0_4px_10px_var(--tk-shadow)]'>
        <Qr model={model} size={150} />
      </div>

      <div className='flex flex-1 flex-col px-5 pt-[14px] pb-[13px]'>
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-navy)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-3' />

        <p className='mt-[5px] truncate border-t border-[var(--tk-accent-soft)] pt-[6px] text-[9.5px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* ----------------------------- Termal Mono ------------------------------ */

/**
 * Tanpa warna sama sekali. Printer thermal dan fotokopi pudar mengubah tint dan
 * abu-abu muda menjadi bintik, jadi hierarki di sini hanya dari ketebalan huruf
 * dan garis hitam. Rasio kontrasnya 21:1 — yang tertinggi di antara delapan.
 */
function ThermalBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div aria-hidden className='h-[3px] w-full bg-[var(--tk-mono-ink)]' />

      <div className='px-5 pt-[14px]'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-mono-ink)]'
          badgeClassName='text-[var(--tk-mono-muted)]'
        />

        <div className='mt-[14px] flex justify-center'>
          <Qr model={model} size={150} />
        </div>

        <p className='mt-[10px] truncate text-center font-mono text-[18px] leading-[18px] font-bold tracking-[0.08em]'>
          {model.code}
        </p>
        <p className='mt-[6px] truncate text-center font-mono text-[10.5px] leading-[11px] text-[var(--tk-mono-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div
        aria-hidden
        className='mt-[14px] h-px w-full border-t border-dashed border-[var(--tk-mono-ink)]'
      />

      <div className='px-5 pt-[12px] pb-[25px]'>
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-mono-ink)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-[12px]' variant='mono' />

        <p className='mt-[8px] truncate border-t border-[var(--tk-mono-ink)] pt-[8px] text-[9.5px] leading-[12px] text-[var(--tk-mono-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* ------------------------------ Kode Besar ------------------------------ */

/**
 * Kode booking sebagai elemen terbesar. Ini melayani jalur yang sudah ada di
 * API: saat QR gagal dipindai, petugas mengetik kode booking — jadi kode itu
 * harus terbaca dari jarak satu meter, bukan jadi teks terkecil di kartu.
 * Rel aksen di kiri memberi siluet yang tidak dimiliki desain lain.
 */
function LargeCodeBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div
        aria-hidden
        className='absolute inset-y-0 left-0 w-2 bg-[var(--tk-accent)]'
      />

      <div className='pr-5 pl-[28px] pt-4'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-ink)]'
          badgeClassName='text-[var(--tk-muted)]'
        />

        <div className='mt-[14px] flex justify-center'>
          <Qr model={model} size={150} />
        </div>

        <p className='mt-[10px] truncate text-center font-mono text-[30px] leading-[30px] font-bold tracking-[0.02em]'>
          {model.code}
        </p>
        <p className='mt-[6px] truncate text-center text-[10.5px] leading-[11px] text-[var(--tk-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div aria-hidden className='mt-[11px] h-px w-full border-t border-dashed border-[var(--tk-seam)]' />

      <div className='pr-5 pl-[28px] pt-[12px] pb-[15px]'>
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-[12px]' />

        <p className='mt-[10px] truncate border-t border-[var(--tk-accent-soft)] pt-[8px] text-[9.5px] leading-[12px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* -------------------------------- Malam --------------------------------- */

/**
 * Kartu gelap untuk gerbang malam. QR tetap di alas putih: QR terbalik (modul
 * terang di atas gelap) gagal di sebagian pemindai gate, jadi latarnya tidak
 * boleh ikut gelap meski seluruh kartu gelap.
 */
function NightBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div className='px-5 pt-[14px]'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-night-ink)]'
          badgeClassName='text-[var(--tk-night-muted)]'
          logoBoxClassName='bg-white p-[2px]'
        />

        <div className='mt-4 flex justify-center'>
          <div className='rounded-xl bg-white p-2'>
            <Qr model={model} size={150} />
          </div>
        </div>

        <p className='mt-3 truncate text-center font-mono text-[20px] leading-[20px] font-bold tracking-[0.06em]'>
          {model.code}
        </p>
        <p className='mt-[6px] truncate text-center text-[10.5px] leading-[11px] text-[var(--tk-night-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div aria-hidden className='mt-3 h-px w-full bg-[var(--tk-night-line)]' />

      <div className='px-5 pt-[12px] pb-[6px]'>
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-night-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-3' variant='night' />

        <p className='mt-[10px] truncate border-t border-[var(--tk-night-line)] pt-[8px] text-[9.5px] leading-[12px] text-[var(--tk-night-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}

/* ------------------------------ Pita Sobek ------------------------------ */

/**
 * Kartu dengan stub yang disobek petugas gate. Stub memuat ulang kode, tanggal,
 * jadwal, dock, plat, dan supir supaya potongan yang tertinggal di gerbang
 * masih bisa dicocokkan tanpa bagian atasnya.
 */
function TearoffBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div className='px-5 pt-4'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-accent)]'
          badgeClassName='text-[var(--tk-badge)]'
        />

        <div className='mt-3 flex justify-center'>
          <Qr model={model} size={140} />
        </div>

        <p className='mt-[10px] truncate text-center font-mono text-[18px] leading-[18px] font-bold tracking-[0.06em]'>
          {model.code}
        </p>
        <p className='mt-[5px] truncate text-center text-[10.5px] leading-[11px] text-[var(--tk-muted)]'>
          {model.customer} · {model.warehouse}
        </p>

        <p className='mt-4 truncate text-[11px] leading-[11px] font-bold text-[var(--tk-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-[10px]' />
      </div>

      <div
        aria-hidden
        className='mt-[8px] h-px w-full border-t border-dashed border-[var(--tk-seam)]'
      />

      <div className='bg-[var(--tk-stub)] px-5 pt-[10px] pb-[16px]'>
        <p className='truncate font-mono text-[13px] leading-[14px] font-bold'>
          {model.code} · {model.stub.dock}
        </p>
        <p className='mt-1 truncate text-[11px] leading-[12px] text-[var(--tk-ink)]'>
          {model.stub.date} · {model.stub.schedule}
        </p>
        <p className='mt-1 truncate text-[11px] leading-[12px] text-[var(--tk-muted)]'>
          {model.stub.plate} · {model.stub.driver}
        </p>
      </div>
    </>
  )
}

/* ------------------------------ Warna Merek ------------------------------ */

/**
 * Pita atas memakai warna merek dari halaman masuk. Warna itu isian bebas
 * Admin, jadi dua penjaga dipakai: teks di dalam pita memilih hitam atau putih
 * menurut kontras, dan aksen di atas putih digelapkan sampai lolos 4,5:1
 * (lihat `readableOn`/`accentOnWhite`). Kuning terang tetap menghasilkan tiket
 * yang terbaca, bukan pita dengan teks putih yang hilang.
 */
function BrandBody({ model, logoUrl }: BodyProps) {
  return (
    <>
      <div className='bg-[var(--tk-band)] px-5 pt-[14px] pb-[46px] text-[var(--tk-band-ink)]'>
        <BrandRow
          model={model}
          logoUrl={logoUrl}
          brandClassName='text-[var(--tk-band-ink)]'
          badgeClassName='text-[var(--tk-band-muted)]'
        />

        <p className='mt-3 truncate font-mono text-[22px] leading-[22px] font-bold tracking-[0.04em]'>
          {model.code}
        </p>
        <p className='mt-[6px] truncate text-[10.5px] leading-[12px] text-[var(--tk-band-muted)]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div className='relative mx-auto -mt-[34px] w-[166px] rounded-xl bg-white p-2 shadow-[0_4px_10px_var(--tk-shadow)]'>
        <Qr model={model} size={150} />
      </div>

      <div className='px-5 pt-4 pb-4'>
        <p className='truncate text-[11px] leading-[11px] font-bold text-[var(--tk-accent)]'>
          {model.instruction}
        </p>

        <FieldGrid model={model} className='mt-3' />

        <p className='mt-[10px] truncate border-t border-[var(--tk-accent-soft)] pt-[8px] text-[9.5px] leading-[12px] text-[var(--tk-muted)]'>
          {model.fallback}
        </p>
      </div>
    </>
  )
}
