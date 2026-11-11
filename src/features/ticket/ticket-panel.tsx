import { useEffect, useMemo, useState } from 'react'
import { Download, MessageCircle, Printer } from 'lucide-react'
import { toast } from 'sonner'
import type { PublicTicket } from '@/lib/api/types'
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
  const model = useMemo(() => buildTicketModel(ticket), [ticket])
  const [ready, setReady] = useState<{
    model: typeof model
    url: string
  } | null>(null)
  // PNG hanya dipakai kalau dibuat dari model yang sedang tampil; kalau tiket
  // berubah, gambar lama tidak boleh terunduh.
  const png = ready?.model === model ? ready.url : null

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
    if (ready?.model === model) return
    let cancelled = false
    void renderTicketPng(model)
      .then((url) => {
        if (!cancelled) setReady({ model, url })
      })
      // Gagal menyiapkan lebih awal bukan alasan mematikan tombol: klik
      // berikutnya mencoba lagi dan baru menampilkan pesan kalau ikut gagal.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [model, ready])

  const onDownload = () => {
    void downloadTicket(model, png).catch(() => {
      toast.error('Tiket gagal diunduh. Coba lagi.')
    })
  }

  return (
    <div className='space-y-3'>
      <TicketCard model={model} />

      {ticket.lateMinutes > 0 && !finished && (
        <p className='text-center text-sm font-medium text-orange-600 dark:text-orange-400'>
          Terlambat {ticket.lateMinutes} menit dari jadwal
        </p>
      )}

      {!finished && (
        <div className='space-y-2'>
          <Button className='h-11 w-full' onClick={onDownload}>
            <Download /> Unduh Tiket
          </Button>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              className='h-11'
              variant='outline'
              onClick={() => window.print()}
            >
              <Printer /> Cetak
            </Button>
            <Button className='h-11' asChild variant='outline'>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Tiket truk ${ticket.bookingCode} - ${ticket.warehouseName}\n${window.location.href}`
                )}`}
                target='_blank'
                rel='noreferrer'
              >
                <MessageCircle /> Kirim WhatsApp
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
