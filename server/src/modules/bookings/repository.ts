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
  assignedDock: { select: { id: true, dockCode: true, allowedActivity: true } },
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

export function buildBookingCode(dateISO: string, sequence: number): string {
  return `TSB-${dateISO.replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`
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
