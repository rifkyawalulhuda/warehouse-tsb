import type { PublicTicket } from '@/lib/api/types'
import { activityLabels, formatDate, formatTime } from '@/lib/format'

/**
 * Isi kartu tiket dipisah dari tampilannya karena kartu yang sama muncul di
 * tiga tempat: layar supir, hasil cetak, dan PNG yang diunduh. Kalau teksnya
 * dirakit di dua tempat, cepat atau lambat keduanya berbeda.
 */
export type TicketField = { label: string; value: string }

export type TicketModel = {
  code: string
  qrToken: string
  customer: string
  warehouse: string
  fields: TicketField[]
  instruction: string
  fallback: string
}

export function buildTicketModel(ticket: PublicTicket): TicketModel {
  return {
    code: ticket.bookingCode,
    qrToken: ticket.qrToken,
    customer: ticket.customerName,
    warehouse: ticket.warehouseName,
    fields: [
      { label: 'Tanggal', value: formatDate(ticket.bookingDate) },
      {
        label: 'Jadwal',
        value: `${formatTime(ticket.startTime)}–${formatTime(ticket.endTime)}`,
      },
      { label: 'Aktivitas', value: activityLabels[ticket.activityType] },
      { label: 'Jenis truk', value: ticket.truckType.truckName },
      { label: 'Plat nomor', value: ticket.licensePlate ?? '-' },
      { label: 'Supir', value: ticket.driverName ?? '-' },
      { label: 'Dock', value: ticket.dockCode ?? 'Belum ditentukan' },
      { label: 'No. dokumen', value: ticket.referenceDocNo },
    ],
    instruction: 'Tunjukkan QR ini di gerbang',
    fallback: 'QR gagal dipindai? Sebutkan kode booking ke petugas gate.',
  }
}

/** Nama berkas memakai kode booking supaya satu folder unduhan tetap terbaca. */
export function ticketFileName(code: string) {
  return `tiket-${code}.png`
}
