/**
 * Label berkas Excel laporan.
 *
 * Berkas ini dibaca di luar aplikasi (Excel, Google Sheets), jadi ia tidak
 * punya akses ke kamus antarmuka di `src/lib/i18n`. Parameter `lang` dari
 * tautan unduhan menentukan bahasanya; tanpa parameter, berkas tetap berbahasa
 * Indonesia seperti sebelumnya.
 */

export type ReportLang = 'id' | 'en'

type Labels = {
  sheets: {
    staffDetail: string
    customerSummary: string
    customerDetail: string
    byDay: string
  }
  columns: {
    metric: string
    value: string
    bookingCode: string
    bookingDate: string
    activity: string
    customer: string
    truckType: string
    dock: string
    status: string
    approval: string
    scheduledStart: string
    gateInAt: string
    processStartedAt: string
    processCompletedAt: string
    gateOutAt: string
    waiting: string
    processing: string
    turnaround: string
    late: string
    licensePlate: string
    driver: string
    referenceDocNo: string
    blocks: string
    slotMinutes: string
    slotUsed: string
    slotOverrun: string
    date: string
    total: string
    completed: string
    cancelled: string
    noShow: string
    expired: string
    averageWaiting: string
    averageProcessing: string
    averageTurnaround: string
    averageSlotUsed: string
  }
  metrics: {
    customerName: string
    customerCode: string
    period: string
    totalBookings: string
    completed: string
    cancelled: string
    noShow: string
    expired: string
    onTimeRate: string
    averageWaiting: string
    averageProcessing: string
    averageTurnaround: string
    averageLate: string
    averageSlotUsed: string
    overruns: string
  }
  /** Pemisah rentang tanggal, mis. "2026-11-01 s/d 2026-11-30". */
  rangeSeparator: string
}

const ID: Labels = {
  sheets: {
    staffDetail: 'Detail Booking',
    customerSummary: 'Ringkasan',
    customerDetail: 'Detail',
    byDay: 'per Hari',
  },
  columns: {
    metric: 'Metrik',
    value: 'Nilai',
    bookingCode: 'Kode',
    bookingDate: 'Tanggal',
    activity: 'Aktivitas',
    customer: 'Customer',
    truckType: 'Jenis Truk',
    dock: 'Dock',
    status: 'Status',
    approval: 'Persetujuan',
    scheduledStart: 'Jadwal',
    gateInAt: 'Gate In',
    processStartedAt: 'Mulai Proses',
    processCompletedAt: 'Selesai Proses',
    gateOutAt: 'Gate Out',
    waiting: 'Tunggu (mnt)',
    processing: 'Proses (mnt)',
    turnaround: 'Turnaround (mnt)',
    late: 'Terlambat (mnt)',
    licensePlate: 'Plat Nomor',
    driver: 'Supir',
    referenceDocNo: 'No. Dokumen',
    blocks: 'Blok',
    slotMinutes: 'Menit Slot',
    slotUsed: 'Pemakaian Slot (%)',
    slotOverrun: 'Lewat Blok (mnt)',
    date: 'Tanggal',
    total: 'Total',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    noShow: 'No-show',
    expired: 'Kedaluwarsa',
    averageWaiting: 'Rata-rata Tunggu (mnt)',
    averageProcessing: 'Rata-rata Proses (mnt)',
    averageTurnaround: 'Rata-rata Turnaround (mnt)',
    averageSlotUsed: 'Rata-rata Pemakaian Slot (%)',
  },
  metrics: {
    customerName: 'Perusahaan',
    customerCode: 'Kode customer',
    period: 'Periode',
    totalBookings: 'Total booking',
    completed: 'Selesai (gate-out)',
    cancelled: 'Dibatalkan',
    noShow: 'No-show',
    expired: 'Kedaluwarsa (tidak disetujui)',
    onTimeRate: 'Tingkat on-time (%)',
    averageWaiting: 'Rata-rata waktu tunggu (menit)',
    averageProcessing: 'Rata-rata waktu proses (menit)',
    averageTurnaround: 'Rata-rata turnaround (menit)',
    averageLate: 'Rata-rata keterlambatan (menit)',
    averageSlotUsed: 'Rata-rata pemakaian slot (%)',
    overruns: 'Booking melewati blok',
  },
  rangeSeparator: 's/d',
}

const EN: Labels = {
  sheets: {
    staffDetail: 'Booking Detail',
    customerSummary: 'Summary',
    customerDetail: 'Detail',
    byDay: 'Per Day',
  },
  columns: {
    metric: 'Metric',
    value: 'Value',
    bookingCode: 'Code',
    bookingDate: 'Date',
    activity: 'Activity',
    customer: 'Customer',
    truckType: 'Truck type',
    dock: 'Dock',
    status: 'Status',
    approval: 'Approval',
    scheduledStart: 'Scheduled',
    gateInAt: 'Gate In',
    processStartedAt: 'Process Start',
    processCompletedAt: 'Process End',
    gateOutAt: 'Gate Out',
    waiting: 'Wait (min)',
    processing: 'Processing (min)',
    turnaround: 'Turnaround (min)',
    late: 'Late (min)',
    licensePlate: 'Plate Number',
    driver: 'Driver',
    referenceDocNo: 'Document No.',
    blocks: 'Blocks',
    slotMinutes: 'Slot minutes',
    slotUsed: 'Slot usage (%)',
    slotOverrun: 'Overrun (min)',
    date: 'Date',
    total: 'Total',
    completed: 'Completed',
    cancelled: 'Cancelled',
    noShow: 'No-show',
    expired: 'Expired',
    averageWaiting: 'Average wait (min)',
    averageProcessing: 'Average processing (min)',
    averageTurnaround: 'Average turnaround (min)',
    averageSlotUsed: 'Average slot usage (%)',
  },
  metrics: {
    customerName: 'Company',
    customerCode: 'Customer code',
    period: 'Period',
    totalBookings: 'Total bookings',
    completed: 'Completed (gate-out)',
    cancelled: 'Cancelled',
    noShow: 'No-show',
    expired: 'Expired (not approved)',
    onTimeRate: 'On-time rate (%)',
    averageWaiting: 'Average waiting time (minutes)',
    averageProcessing: 'Average processing time (minutes)',
    averageTurnaround: 'Average turnaround (minutes)',
    averageLate: 'Average delay (minutes)',
    averageSlotUsed: 'Average slot usage (%)',
    overruns: 'Bookings over block',
  },
  rangeSeparator: 'to',
}

export const REPORT_LABELS: Record<ReportLang, Labels> = { id: ID, en: EN }

const BOOKING_STATUS: Record<ReportLang, Record<string, string>> = {
  id: {
    BOOKED_INCOMPLETE: 'Menunggu data kendaraan',
    BOOKED_READY: 'Siap masuk',
    CHECKED_IN_ON_TIME: 'Check-in tepat waktu',
    LATE_WAITING_LIST: 'Antrean terlambat',
    DOCK_ASSIGNED: 'Dapat dock',
    IN_PROGRESS: 'Sedang diproses',
    COMPLETED: 'Selesai bongkar/muat',
    CHECKED_OUT: 'Sudah keluar',
    CANCELLED: 'Dibatalkan',
    NO_SHOW: 'Tidak datang',
  },
  en: {
    BOOKED_INCOMPLETE: 'Waiting for vehicle data',
    BOOKED_READY: 'Ready to enter',
    CHECKED_IN_ON_TIME: 'Checked in on time',
    LATE_WAITING_LIST: 'Late queue',
    DOCK_ASSIGNED: 'Dock assigned',
    IN_PROGRESS: 'In progress',
    COMPLETED: 'Loading/unloading done',
    CHECKED_OUT: 'Checked out',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No-show',
  },
}

const APPROVAL_STATUS: Record<ReportLang, Record<string, string>> = {
  id: {
    NOT_REQUIRED: 'Tidak perlu persetujuan',
    PENDING: 'Menunggu persetujuan',
    APPROVED: 'Disetujui',
    REJECTED: 'Ditolak',
    EXPIRED: 'Kedaluwarsa',
  },
  en: {
    NOT_REQUIRED: 'Not required',
    PENDING: 'Pending approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    EXPIRED: 'Expired',
  },
}

const ACTIVITY_TYPE: Record<ReportLang, Record<string, string>> = {
  id: { LOADING: 'Muat', UNLOADING: 'Bongkar' },
  en: { LOADING: 'Loading', UNLOADING: 'Unloading' },
}

export const bookingStatusLabel = (lang: ReportLang, status: string) =>
  BOOKING_STATUS[lang][status] ?? status

export const approvalStatusLabel = (lang: ReportLang, status: string) =>
  APPROVAL_STATUS[lang][status] ?? status

export const activityTypeLabel = (lang: ReportLang, activity: string) =>
  ACTIVITY_TYPE[lang][activity] ?? activity

/** Nama berkas unduhan: `laporan-…` / `report-…`. */
export const reportFilePrefix = (lang: ReportLang) =>
  lang === 'en' ? 'report' : 'laporan'
