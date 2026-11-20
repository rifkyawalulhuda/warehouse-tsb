import type { PublicTicket } from '@/lib/api/types'
import { activityLabels, formatDate, formatTime } from '@/lib/format'
import { getLocale, translate, type Locale, type MessageKey, type Vars } from '@/lib/i18n'

/**
 * Isi kartu tiket dipisah dari tampilannya karena kartu yang sama muncul di
 * tiga tempat: layar supir, hasil cetak, dan PNG yang diunduh. Kalau teksnya
 * dirakit di dua tempat, cepat atau lambat keduanya berbeda.
 *
 * Terjemahan ikut di sini, bukan di komponen: kanvas menggambar ulang model ini
 * huruf demi huruf, jadi label yang berbeda antara DOM dan PNG akan terlihat
 * sebagai tiket yang berubah setelah diunduh.
 */
export type TicketField = { label: string; value: string }

export type TicketModel = {
  code: string
  qrToken: string
  customer: string
  warehouse: string
  appName: string
  badge: string
  fields: TicketField[]
  instruction: string
  fallback: string
}

type T = (key: MessageKey, vars?: Vars) => string

/**
 * `appName` dikirim pemanggil karena berasal dari pengaturan merek, bukan dari
 * tiket. `t` opsional supaya pemanggil non-React (dan tes lama) tetap bisa
 * memakai bahasa yang sedang aktif.
 */
export function buildTicketModel(
  ticket: PublicTicket,
  options: { appName?: string; t?: T } = {}
): TicketModel {
  const t =
    options.t ?? ((key: MessageKey, vars?: Vars) => translate(getLocale(), key, vars))

  return {
    code: ticket.bookingCode,
    qrToken: ticket.qrToken,
    customer: ticket.customerName,
    warehouse: ticket.warehouseName,
    appName: options.appName?.trim() || t('ticket.brandFallback'),
    badge: t('ticket.eTicket'),
    fields: [
      { label: t('ticket.fieldDate'), value: formatDate(ticket.bookingDate) },
      {
        label: t('ticket.fieldSchedule'),
        value: `${formatTime(ticket.startTime)}–${formatTime(ticket.endTime)}`,
      },
      {
        label: t('ticket.fieldActivity'),
        value: activityLabels[ticket.activityType],
      },
      { label: t('ticket.fieldTruck'), value: ticket.truckType.truckName },
      { label: t('ticket.fieldPlate'), value: ticket.licensePlate ?? '-' },
      { label: t('ticket.fieldDriver'), value: ticket.driverName ?? '-' },
      { label: t('ticket.fieldDock'), value: ticket.dockCode ?? t('ticket.noDock') },
      { label: t('ticket.fieldDocNo'), value: ticket.referenceDocNo },
    ],
    instruction: t('ticket.cardInstruction'),
    fallback: t('ticket.cardFallback'),
  }
}

/**
 * Nama berkas memakai kode booking supaya satu folder unduhan tetap terbaca.
 * Awalan mengikuti bahasa aktif agar berkas yang diunduh tidak berbahasa lain
 * dari tiketnya.
 */
export function ticketFileName(code: string, locale: Locale = getLocale()) {
  return `${translate(locale, 'ticket.filePrefix')}-${code}.png`
}
