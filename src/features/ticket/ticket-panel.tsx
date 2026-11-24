import { useEffect, useMemo, useState } from 'react'
import { Download, MessageCircle, Printer } from 'lucide-react'
import { toast } from 'sonner'
import type { PublicTicket } from '@/lib/api/types'
import { useBranding } from '@/lib/branding'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { TicketCard } from './ticket-card'
import { downloadTicket, renderTicketPng } from './ticket-image'
import { buildTicketModel } from './ticket-model'
import { hideForPrint, restoreAfterPrint } from './ticket-print'

/**
 * Kartu tiket beserta aksinya. PNG disiapkan diam-diam begitu kartu tampil,
 * supaya klik "Unduh" tidak perlu menunggu dan tidak kehilangan gestur
 * pengguna di Safari iOS.
 */
export function TicketPanel({
  ticket,
  finished,
}: {
  ticket: PublicTicket
  finished: boolean
}) {
  const brand = useBranding()
  const t = useT()
  // `t` berubah saat bahasa diganti, jadi model (dan PNG yang digambar
  // ulang dari model itu) ikut berganti bahasa.
  const model = useMemo(
    () => buildTicketModel(ticket, { appName: brand.appName, t }),
    [ticket, brand.appName, t]
  )
  const [ready, setReady] = useState<{
    model: typeof model
    design: typeof brand.ticketDesign
    logoUrl: string | null
    url: string
  } | null>(null)
  // PNG hanya dipakai kalau dibuat dari isi, desain, dan logo yang sedang
  // tampil; kalau salah satunya berubah, gambar lama tidak boleh terunduh.
  const design = brand.ticketDesign
  const logoUrl = brand.appLogoUrl
  const png =
    ready &&
    ready.model === model &&
    ready.design === design &&
    ready.logoUrl === logoUrl
      ? ready.url
      : null

  // Ctrl+P juga harus menghasilkan kartu saja, bukan hanya tombol Cetak.
  useEffect(() => {
    const before = () => {
      const card = document.querySelector('[data-ticket-card]')
      if (card) hideForPrint(card)
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', restoreAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', restoreAfterPrint)
      restoreAfterPrint()
    }
  }, [])

  useEffect(() => {
    if (
      ready &&
      ready.model === model &&
      ready.design === design &&
      ready.logoUrl === logoUrl
    ) {
      return
    }
    let cancelled = false
    void renderTicketPng(model, 2, { design, logoUrl })
      .then((url) => {
        if (!cancelled) setReady({ model, design, logoUrl, url })
      })
      // Gagal menyiapkan lebih awal bukan alasan mematikan tombol: klik
      // berikutnya mencoba lagi dan baru menampilkan pesan kalau ikut gagal.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [model, design, logoUrl, ready])

  const onDownload = () => {
    void downloadTicket(model, png, { design, logoUrl }).catch(() => {
      toast.error(t('ticket.downloadFailed'))
    })
  }

  return (
    <div className='space-y-3'>
      <TicketCard
        model={model}
        design={design}
        logoUrl={logoUrl}
        label={t('ticket.cardLabel', { code: model.code })}
      />

      {ticket.lateMinutes > 0 && !finished && (
        <p className='text-center text-sm font-medium text-orange-600 dark:text-orange-400'>
          {t('ticket.late', { count: ticket.lateMinutes })}
        </p>
      )}

      {!finished && (
        <div className='space-y-2'>
          <Button className='h-11 w-full' onClick={onDownload}>
            <Download /> {t('ticket.download')}
          </Button>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              className='h-11'
              variant='outline'
              onClick={() => window.print()}
            >
              <Printer /> {t('ticket.print')}
            </Button>
            <Button className='h-11' asChild variant='outline'>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  t('ticket.waTemplate', {
                    code: ticket.bookingCode,
                    warehouse: ticket.warehouseName,
                    link: window.location.href,
                  })
                )}`}
                target='_blank'
                rel='noreferrer'
              >
                <MessageCircle /> {t('ticket.sendWhatsapp')}
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
