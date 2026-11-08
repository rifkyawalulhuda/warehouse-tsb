import { prisma } from '../lib/prisma'
import { getSettings, toWindow } from '../lib/settings'
import { minuteOfDayJakarta, utcToDateOnly } from '../lib/time'
import { finalizeRelease } from '../modules/bookings/quota-service'
import { emitBookingUpdated } from '../realtime'
import { writeAudit } from '../lib/audit'

/**
 * Mengakhiri booking yang menunggu keputusan Admin sampai tenggatnya lewat.
 *
 * Wilayah job ini sengaja eksklusif dengan job NO_SHOW: NO_SHOW menyaring
 * `approval_status != 'PENDING'`, job ini hanya mengambil `PENDING`. Keduanya
 * tidak pernah berebut booking yang sama, sehingga bucket KPI `expiredPending`
 * benar-benar berisi booking yang gagal karena Admin tidak memutuskan — bukan
 * karena customer tidak datang.
 *
 * Kuota dilepas lewat `finalizeRelease`, yang menjamin pelepasan tepat sekali
 * walau Admin menyetujui booking di detik yang sama. Lihat rencana §4.3–§4.4.
 *
 * Dijalankan setiap 5 menit; tenggat default 30 menit sebelum kedatangan,
 * sehingga keterlambatan pemrosesan maksimum 5 menit masih dapat diterima.
 */
export async function expirePendingApprovals(now: Date = new Date()): Promise<number> {
  const settings = await getSettings()
  const window = toWindow(settings)

  const candidates = await prisma.booking.findMany({
    where: {
      approvalStatus: 'PENDING',
      // Booking yang sudah dibatalkan customer tetap ber-approval PENDING
      // (approval tidak pernah selesai), tetapi bukan urusan job ini: melepas
      // kuotanya dua kali dan menulis audit EXPIRED yang menyesatkan.
      status: { in: ['BOOKED_INCOMPLETE', 'BOOKED_READY'] },
      approvalDeadline: { lte: now },
    },
    take: 200,
  })

  let expired = 0

  for (const booking of candidates) {
    const expiredNow = await prisma.$transaction(async (tx) => {
      // Compare-and-set DULU, baru lepas kuota. Urutan sebaliknya berbahaya:
      // bila Admin menyetujui di detik yang sama, approve memenangkan status
      // tetapi kuota sudah terlanjur dilepas untuk booking yang sah.
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE bookings
        SET status = 'CANCELLED',
            approval_status = 'EXPIRED'
        WHERE id = ${booking.id}::uuid
          AND approval_status = 'PENDING'
        RETURNING id
      `

      if (updated.length === 0) return false

      await finalizeRelease(tx, {
        bookingId: booking.id,
        date: utcToDateOnly(booking.bookingDate),
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        blocksRequired: booking.blocksLocked,
        window,
      })

      await writeAudit(
        {
          userId: null,
          userRole: 'ADMIN',
          action: 'BOOKING_APPROVAL_EXPIRED',
          bookingId: booking.id,
          meta: {
            detectedAt: now.toISOString(),
            deadline: booking.approvalDeadline?.toISOString() ?? null,
          },
        },
        tx
      )

      return true
    })

    if (!expiredNow) continue

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CANCELLED',
      customerId: booking.customerId,
    })
    expired += 1
  }

  return expired
}

const INTERVAL_MS = 5 * 60 * 1000

export function startApprovalExpiryJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const expired = await expirePendingApprovals()
      if (expired > 0) {
        // eslint-disable-next-line no-console
        console.log(`[job] ${expired} booking approval kedaluwarsa`)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[job] approval expiry gagal', error)
    }
  }

  void run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return timer
}
