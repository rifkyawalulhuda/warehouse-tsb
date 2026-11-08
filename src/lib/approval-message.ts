import { formatDate, formatTime } from '@/lib/format'

export type ApprovalMessageKind = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * Template pesan WhatsApp. Fase 1 sengaja tanpa email/penyedia pihak ketiga:
 * nomor pengirim belum punya domain terverifikasi, dan `wa.me` sudah dipakai
 * untuk berbagi tiket. Admin menyalin pesan ini lalu mengirimnya sendiri.
 */
export function buildApprovalMessage(
  booking: {
    bookingCode: string
    bookingDate: string
    startTime: string
    referenceDocNo: string
  },
  options: { kind: ApprovalMessageKind; reason?: string | null }
): string {
  const when = `${formatDate(booking.bookingDate)} pukul ${formatTime(booking.startTime)}`

  switch (options.kind) {
    case 'pending':
      return [
        `Booking ${booking.bookingCode} (${when}) masih MENUNGGU PERSETUJUAN admin gudang.`,
        `Dokumen: ${booking.referenceDocNo}.`,
        'QR Code baru aktif setelah disetujui.',
      ].join('\n')
    case 'approved':
      return [
        `Booking ${booking.bookingCode} (${when}) telah DISETUJUI.`,
        'QR Code sudah aktif — tunjukkan di gerbang gudang.',
      ].join('\n')
    case 'rejected':
      return [
        `Booking ${booking.bookingCode} (${when}) DITOLAK.`,
        `Alasan: ${options.reason ?? '-'}.`,
        'Silakan buat booking baru.',
      ].join('\n')
    case 'expired':
      return [
        `Booking ${booking.bookingCode} (${when}) KEDALUWARSA karena tidak diputuskan sampai tenggat.`,
        'Silakan buat booking baru.',
      ].join('\n')
  }
}
