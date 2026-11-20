import { getLocale, translate, type MessageKey } from '@/lib/i18n'
import { formatDate, formatTime } from '@/lib/format'

export type ApprovalMessageKind = 'pending' | 'approved' | 'rejected' | 'expired'

/**
 * Template pesan WhatsApp. Fase 1 sengaja tanpa email/penyedia pihak ketiga:
 * nomor pengirim belum punya domain terverifikasi, dan `wa.me` sudah dipakai
 * untuk berbagi tiket. Admin menyalin pesan ini lalu mengirimnya sendiri.
 *
 * Teksnya dibaca dari kamus saat dipanggil, bukan disusun sekali di modul:
 * pesan yang disalin Admin harus mengikuti bahasa antarmuka yang sedang aktif.
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
  const locale = getLocale()
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, `approvalMsg.${key}` as MessageKey, vars)

  const when = `${formatDate(booking.bookingDate)} ${t('at')} ${formatTime(booking.startTime)}`

  switch (options.kind) {
    case 'pending':
      return [
        t('pendingBody', { code: booking.bookingCode, when }),
        t('docLine', { doc: booking.referenceDocNo }),
        t('qrPending'),
      ].join('\n')
    case 'approved':
      return [
        t('approvedBody', { code: booking.bookingCode, when }),
        t('qrActive'),
      ].join('\n')
    case 'rejected':
      return [
        t('rejectedBody', { code: booking.bookingCode, when }),
        t('reasonLine', { reason: options.reason ?? '-' }),
        t('createNew'),
      ].join('\n')
    case 'expired':
      return [
        t('expiredBody', { code: booking.bookingCode, when }),
        t('createNew'),
      ].join('\n')
  }
}
