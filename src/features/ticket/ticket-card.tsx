import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'
import type { TicketModel } from './ticket-model'

/**
 * Kartu tiket yang dilihat supir. Tata letaknya sengaja dipatok (bukan
 * mengalir bebas) karena hasil unduhan PNG menggambar ulang kartu ini di
 * kanvas dengan ukuran yang sama — lihat `ticket-image.ts`. Angka jarak di
 * sini dan di sana harus bergerak bersama.
 */
export function TicketCard({
  model,
  className,
}: {
  model: TicketModel
  className?: string
}) {
  return (
    <article
      data-ticket-card
      aria-label={`Tiket ${model.code}`}
      className={cn(
        'mx-auto w-full max-w-[360px] overflow-hidden rounded-[18px] bg-white text-[#0f172a] shadow-lg ring-1 ring-black/5',
        className
      )}
    >
      <div className='px-5 pt-4'>
        <div className='flex items-center justify-between text-[10px] leading-none font-bold tracking-[0.14em] uppercase'>
          <span className='text-[#1d4ed8]'>Warehouse TSB</span>
          <span className='font-semibold text-[#94a3b8]'>E-Tiket</span>
        </div>

        <div className='mt-[22px] flex justify-center'>
          <QRCodeSVG
            value={model.qrToken}
            size={162}
            level='M'
            marginSize={2}
            bgColor='#ffffff'
            fgColor='#0f172a'
          />
        </div>

        <p className='mt-2 text-center font-mono text-lg leading-[18px] font-bold tracking-[0.06em]'>
          {model.code}
        </p>
        <p className='mt-2 text-center text-[10.5px] leading-[10.5px] text-[#556579]'>
          {model.customer} · {model.warehouse}
        </p>
      </div>

      <div
        aria-hidden
        className='mt-[18px] h-px w-full'
        style={{
          backgroundImage:
            'repeating-linear-gradient(to right, #cbd5e1 0 7px, transparent 7px 14px)',
        }}
      />

      <div className='bg-[#edf1fc] px-5 pt-[14px] pb-4'>
        <p className='text-[11px] leading-[11px] font-bold text-[#1d4ed8]'>
          {model.instruction}
        </p>

        <dl className='mt-3 grid grid-cols-2 gap-x-4'>
          {model.fields.map((field) => (
            <div key={field.label} className='min-w-0 pb-[7px]'>
              <dt className='text-[9.5px] leading-[10px] font-medium tracking-[0.08em] text-[#556579] uppercase'>
                {field.label}
              </dt>
              <dd className='text-[12.5px] leading-[17px] font-semibold break-words'>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className='mt-2 border-t border-[#1d4ed8]/20 pt-2 text-[9.5px] text-[#556579]'>
          {model.fallback}
        </p>
      </div>
    </article>
  )
}
