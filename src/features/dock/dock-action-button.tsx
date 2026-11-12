import { CheckCircle2, PlayCircle } from 'lucide-react'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { Button } from '@/components/ui/button'

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
  const booking = dock.currentBooking
  if (!booking) {
    return <span className='text-xs text-muted-foreground'>—</span>
  }

  const serving = booking.status === 'IN_PROGRESS'
  const label = serving ? 'Selesaikan' : 'Mulai'
  const ariaLabel = `${serving ? 'Selesaikan' : 'Mulai'} proses ${
    booking.bookingCode
  } di ${dock.dockCode}`
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
