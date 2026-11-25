import type { ApprovalMode, Booking, BookingStatus, Prisma, Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'

/** Bentuk booking yang dikirim ke frontend (tiket supir, dashboard, daftar customer). */
export const bookingSelect = {
  id: true,
  bookingCode: true,
  qrToken: true,
  activityType: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  referenceDocNo: true,
  licensePlate: true,
  driverName: true,
  driverPhone: true,
  blocksLocked: true,
  status: true,
  lateMinutes: true,
  approvalStatus: true,
  approvalDeadline: true,
  approvedAt: true,
  rejectionReason: true,
  createdAt: true,
  customer: { select: { id: true, name: true, code: true } },
  /// Akun yang menekan tombol booking. Jejak, bukan pemilik.
  createdBy: { select: { id: true, name: true } },
  truckType: { select: { id: true, truckName: true, durationMinutes: true, blocksRequired: true } },
  assignedDock: {
    select: { id: true, dockCode: true, allowedActivity: true, areaName: true },
  },
  timeLog: {
    select: {
      vehicleCompletedAt: true,
      gateInAt: true,
      dockAssignedAt: true,
      processStartedAt: true,
      processCompletedAt: true,
      gateOutAt: true,
    },
  },
} satisfies Prisma.BookingSelect

export type BookingDetail = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>

export const ACTIVE_STATUSES: BookingStatus[] = [
  'BOOKED_INCOMPLETE',
  'BOOKED_READY',
  'CHECKED_IN_ON_TIME',
  'LATE_WAITING_LIST',
  'DOCK_ASSIGNED',
  'IN_PROGRESS',
]

/** Status yang menandakan QR sudah tidak boleh dipindai untuk aksi apa pun. */
export const FINAL_STATUSES: BookingStatus[] = ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW']

export function getBookingById(id: string) {
  return prisma.booking.findUnique({ where: { id }, select: bookingSelect })
}

export function getBookingByQrToken(qrToken: string) {
  return prisma.booking.findUnique({ where: { qrToken }, select: bookingSelect })
}

/**
 * Bentuk kode booking: `ABC-YYYYMMDD-NNN`.
 *
 * Awalannya sengaja TIDAK dikunci ke `TSB`. Admin boleh mengganti awalan lewat
 * Pengaturan, dan tiket yang sudah tercetak sebelum penggantian tetap harus
 * bisa dipindai di gate. Yang penting adalah bentuknya: tiga huruf/angka,
 * tanggal delapan digit, lalu nomor urut.
 *
 * Urutan 1–3 digit ditoleransi agar tiket lama yang tercetak tanpa nol di
 * depan (`...-92`) tetap bisa dipindai. Kode baru selalu 3 digit.
 */
const BOOKING_CODE_PATTERN = /^[A-Z0-9]{3}-\d{8}-\d{1,3}$/i

/** Awalan bawaan, dipakai saat pengaturan belum punya nilai. */
export const DEFAULT_BOOKING_CODE_PREFIX = 'TSB'

/**
 * Awalan sah: tepat 3 huruf/angka.
 *
 * Huruf besar dipaksa di skema, jadi `tkt` dan `TKT` adalah awalan yang sama.
 * Tanda hubung tidak boleh ikut: awalan adalah bagian sebelum `-` pertama.
 */
const PREFIX_PATTERN = /^[A-Z0-9]{3}$/

/** Rapikan awalan dari pengaturan; nilai tak sah jatuh ke bawaan. */
export function normalizeBookingCodePrefix(value: string | null | undefined): string {
  const prefix = (value ?? '').trim().toUpperCase()
  return PREFIX_PATTERN.test(prefix) ? prefix : DEFAULT_BOOKING_CODE_PREFIX
}

/** Apakah masukan berbentuk kode booking (bukan token QR)? */
export function isBookingCode(value: string): boolean {
  return BOOKING_CODE_PATTERN.test(value.trim())
}

/**
 * Nomor urut bebas berikutnya untuk satu tanggal, mulai dari `start`.
 *
 * Penghitung harian bisa tertinggal dari kode yang sudah ada — misalnya setelah
 * data lama diimpor atau penghitungnya direset. Tanpa lompatan ini, pembuatan
 * booking berikutnya gagal karena bentrok kode unik, dan gagalnya berupa 500
 * yang tidak bisa ditindaklanjuti dari layar.
 */
export async function nextFreeSequence(
  db: Pick<typeof prisma, 'booking'>,
  dateISO: string,
  start: number,
  prefix: string = DEFAULT_BOOKING_CODE_PREFIX
): Promise<number> {
  const codePrefix = `${normalizeBookingCodePrefix(prefix)}-${dateISO.replace(/-/g, '')}-`
  const rows = await db.booking.findMany({
    where: { bookingCode: { startsWith: codePrefix } },
    select: { bookingCode: true },
  })

  const used = new Set(rows.map((row) => Number(row.bookingCode.slice(codePrefix.length))))
  let sequence = Math.max(1, start)
  while (used.has(sequence) && sequence < 999) sequence += 1
  return sequence
}

/**
 * Filter `where` untuk satu masukan layar gate.
 *
 * Dipakai jalur yang butuh relasi ikut termuat (gate-in/gate-out). Bila masukan
 * berbentuk kode booking, dua kolom dicari sekaligus; selain itu hanya `qrToken`.
 *
 * Hanya untuk endpoint ops yang sudah dijaga peran. Tiket publik tetap memakai
 * `getBookingByQrToken` karena kode booking mudah ditebak
 * (`ABC-tanggal-urut`).
 */
export function scanInputWhere(input: string): Prisma.BookingWhereInput {
  const value = input.trim()
  return isBookingCode(value)
    ? { OR: [{ qrToken: value }, { bookingCode: value.toUpperCase() }] }
    : { qrToken: value }
}

/**
 * Satu pintu pencarian tiket di layar gate: token QR atau kode booking.
 *
 * Hanya untuk endpoint ops yang sudah dijaga peran; tiket publik tetap memakai
 * `getBookingByQrToken` karena kode booking mudah ditebak.
 */
export function getBookingByScanInput(input: string) {
  return prisma.booking.findFirst({ where: scanInputWhere(input), select: bookingSelect })
}

export function isFinalStatus(status: BookingStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

/** Booking ini sudah pernah melewati gate-in? */
export function hasEnteredGate(booking: Pick<Booking, 'status'>): boolean {
  return ![
    'BOOKED_INCOMPLETE',
    'BOOKED_READY',
    'CANCELLED',
    'NO_SHOW',
  ].includes(booking.status)
}

export function hasVehicleData(booking: {
  licensePlate: string | null
  driverName: string | null
}): boolean {
  return Boolean(booking.licensePlate?.trim() && booking.driverName?.trim())
}

/** Status setelah data kendaraan diubah, tanpa menyentuh booking yang sudah masuk gate. */
export function statusForVehicleData(
  currentStatus: BookingStatus,
  complete: boolean
): BookingStatus {
  if (currentStatus !== 'BOOKED_INCOMPLETE' && currentStatus !== 'BOOKED_READY') {
    return currentStatus
  }
  return complete ? 'BOOKED_READY' : 'BOOKED_INCOMPLETE'
}

export function buildBookingCode(
  dateISO: string,
  sequence: number,
  prefix: string = DEFAULT_BOOKING_CODE_PREFIX
): string {
  return `${normalizeBookingCodePrefix(prefix)}-${dateISO.replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`
}

/**
 * Apakah booking ini harus masuk antrean persetujuan Admin?
 *
 * Hanya tiga syarat, sesuai docs/rencana-approval-booking.md §4.1:
 * mode global MANUAL, pelaku adalah CUSTOMER, dan customer tidak di-whitelist.
 * Admin bertindak atas nama customer tidak pernah masuk antrean.
 */
export function needsApproval(params: {
  approvalMode: ApprovalMode
  role: Role
  autoApproveBooking: boolean
}): boolean {
  if (params.approvalMode !== 'MANUAL') return false
  if (params.role !== 'CUSTOMER') return false
  return !params.autoApproveBooking
}

/**
 * Tenggat keputusan Admin.
 *
 * `max`, bukan `min` (koreksi atas label sesi grilling 6.1): dengan `min`,
 * booking yang dibuat mendesak akan mendapat tenggat yang sudah lewat saat
 * booking dibuat, sehingga langsung expire sebelum Admin sempat melihatnya.
 *
 * Konsekuensi yang diterima: booking 5 menit sebelum jadwal mendapat tenggat
 * `createdAt + minDecisionMinutes`, yaitu setelah `startTime`. Disengaja agar
 * Admin selalu punya jendela keputusan minimum.
 */
export function computeApprovalDeadline(params: {
  startTime: Date
  createdAt: Date
  leadMinutes: number
  minDecisionMinutes: number
}): Date {
  const beforeStart = new Date(params.startTime.getTime() - params.leadMinutes * 60_000)
  const afterCreated = new Date(params.createdAt.getTime() + params.minDecisionMinutes * 60_000)
  return new Date(Math.max(beforeStart.getTime(), afterCreated.getTime()))
}
