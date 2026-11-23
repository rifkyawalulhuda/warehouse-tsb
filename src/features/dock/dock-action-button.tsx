import { CheckCircle2, PlayCircle } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { dockWithArea } from '@/lib/dock-label'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export type DockActionHandlers = {
  actionPending: boolean
  onStart: (booking: Booking, dock: DockWithBooking) => void
  onFinish: (booking: Booking, dock: DockWithBooking) => void
}

/**
 * Satu tombol tindakan untuk semua tampilan. Dock tanpa truk tidak punya
 * tindakan — ditampilkan sebagai tanda pisah, bukan tombol mati.
 */
export function DockActionButton({
  dock,
  actionPending,
  onStart,
  onFinish,
  iconOnly = false,
  hideLabelOnMobile = false,
}: DockActionHandlers & {
  dock: DockWithBooking
  iconOnly?: boolean
  /** Tabel: label disembunyikan di ponsel agar kolom aksi tidak melebar. */
  hideLabelOnMobile?: boolean
}) {
  const t = useT()
  const booking = dock.currentBooking
  if (!booking) {
    return <span className='text-xs text-muted-foreground'>—</span>
  }

  const serving = booking.status === 'IN_PROGRESS'
  const label = serving ? t('dock.finish') : t('dock.start')
  // Pembaca layar ikut mendengar area: dua dock berkode mirip bisa berbeda area.
  const place = dockWithArea(dock)
  const ariaLabel = serving
    ? t('dock.finishAria', {
        code: booking.bookingCode,
        dock: place,
      })
    : t('dock.startAria', { code: booking.bookingCode, dock: place })
  const handleClick = () =>
    serving ? onFinish(booking, dock) : onStart(booking, dock)

  if (iconOnly) {
    return (
      <Button
        size='icon'
        variant='outline'
        className='size-11 shrink-0 sm:size-9'
        disabled={actionPending}
        aria-label={ariaLabel}
        title={label}
        onClick={handleClick}
      >
        {serving ? <CheckCircle2 /> : <PlayCircle />}
      </Button>
    )
  }

  return (
    <Button
      size='sm'
      disabled={actionPending}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      {serving ? <CheckCircle2 /> : <PlayCircle />}
      {hideLabelOnMobile ? (
        <span className='max-sm:hidden'>{label}</span>
      ) : (
        label
      )}
    </Button>
  )
}