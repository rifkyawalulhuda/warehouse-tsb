import type { PublicTicket } from '@/lib/api/types'
import { dockWithArea } from '@/lib/dock-label'
import { activityLabels, formatDate, formatTime } from '@/lib/format'
import {
  getLocale,
  translate,
  type Locale,
  type MessageKey,
  type Vars,
} from '@/lib/i18n'

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
  /**
   * Tanggal dan jam dipisah dari `fields` karena desain Minimal menaruhnya
   * sebagai sorotan besar di samping QR, bukan sebagai baris tabel. Nilainya
   * tetap sama dengan dua field pertama di `fields`.
   */
  date: string
  schedule: string
  fields: TicketField[]
  /**
   * Nilai yang diulang di stub desain Pita Sobek. Diambil dari sumber yang sama
   * dengan `fields`, bukan dibaca ulang dari `fields[n]`: stub yang menampilkan
   * dock berbeda dari kartu utamanya justru membuat potongan tiket tidak bisa
   * dicocokkan.
   */
  stub: {
    date: string
    schedule: string
    dock: string
    plate: string
    driver: string
  }
  instruction: string
  fallback: string
}

/**
 * "Rab, 11 Nov 2026" -> hari "Rab" dan tanggal "11 Nov 2026". Desain Minimal
 * menampilkan hari sebagai label kecil di atas tanggal besar. Kalau bentuk
 * bahasanya tidak memakai koma, seluruh teks jadi tanggal dan labelnya kosong —
 * lebih baik daripada memotong di tempat yang salah.
 */
export function splitTicketDate(value: string): { day: string; date: string } {
  const comma = value.indexOf(',')
  if (comma === -1) return { day: '', date: value }
  return {
    day: value.slice(0, comma).trim(),
    date: value.slice(comma + 1).trim(),
  }
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
    options.t ??
    ((key: MessageKey, vars?: Vars) => translate(getLocale(), key, vars))

  const date = formatDate(ticket.bookingDate)
  const schedule = `${formatTime(ticket.startTime)}–${formatTime(ticket.endTime)}`
  const plate = ticket.licensePlate ?? '-'
  const driver = ticket.driverName ?? '-'
  // Supir mencari dock lewat area, jadi area menempel pada kode docknya.
  const dock =
    dockWithArea({
      dockCode: ticket.dockCode,
      areaName: ticket.dockAreaName,
    }) || t('ticket.noDock')

  const fields: TicketField[] = [
    { label: t('ticket.fieldDate'), value: date },
    { label: t('ticket.fieldSchedule'), value: schedule },
    {
      label: t('ticket.fieldActivity'),
      value: activityLabels[ticket.activityType],
    },
    { label: t('ticket.fieldTruck'), value: ticket.truckType.truckName },
    { label: t('ticket.fieldPlate'), value: plate },
    { label: t('ticket.fieldDriver'), value: driver },
    { label: t('ticket.fieldDock'), value: dock },
    { label: t('ticket.fieldDocNo'), value: ticket.referenceDocNo },
  ]

  return {
    code: ticket.bookingCode,
    qrToken: ticket.qrToken,
    customer: ticket.customerName,
    warehouse: ticket.warehouseName,
    appName: options.appName?.trim() || t('ticket.brandFallback'),
    badge: t('ticket.eTicket'),
    date,
    schedule,
    fields,
    stub: { date, schedule, dock, plate, driver },
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

/**
 * Isi contoh untuk pratinjau desain di Pengaturan. Data karangan, bukan booking
 * sungguhan — pratinjau harus tetap bisa dilihat walau belum ada booking, dan
 * tidak boleh membocorkan data customer ke layar pengaturan.
 *
 * Tanggalnya tetap supaya pratinjau tidak berubah tiap hari; yang mengikuti
 * bahasa aktif hanya nama hari, bulan, dan label field.
 */
export function sampleTicketModel(t: T, appName: string): TicketModel {
  const date = formatDate(new Date('2026-11-24T00:00:00.000Z'))
  const schedule = `${formatTime(new Date('2026-11-24T02:00:00.000Z'))}–${formatTime(new Date('2026-11-24T03:00:00.000Z'))}`
  const plate = 'B 1234 XYZ'
  const driver = 'Budi Santoso'
  const dock = 'D-01 · Area A'
  return {
    code: 'TSB-20261124-001',
    qrToken: 'tsb-sample-preview-token-000000',
    customer: 'PT Contoh Nusantara',
    warehouse: 'Gudang Cikarang',
    appName: appName.trim() || t('ticket.brandFallback'),
    badge: t('ticket.eTicket'),
    date,
    schedule,
    fields: [
      { label: t('ticket.fieldDate'), value: date },
      { label: t('ticket.fieldSchedule'), value: schedule },
      { label: t('ticket.fieldActivity'), value: activityLabels.LOADING },
      { label: t('ticket.fieldTruck'), value: 'CDD Box' },
      { label: t('ticket.fieldPlate'), value: plate },
      { label: t('ticket.fieldDriver'), value: driver },
      { label: t('ticket.fieldDock'), value: dock },
      { label: t('ticket.fieldDocNo'), value: 'PO-2026-0142' },
    ],
    stub: { date, schedule, dock, plate, driver },
    instruction: t('ticket.cardInstruction'),
    fallback: t('ticket.cardFallback'),
  }
}
