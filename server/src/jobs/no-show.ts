import { prisma } from '../lib/prisma'
import { getSettings, toWindow } from '../lib/settings'
import {
  dateOnlyToUtc,
  isOperationalDayOver,
  minuteOfDayJakarta,
  todayISO,
  utcToDateOnly,
} from '../lib/time'
import { releaseBlocks } from '../modules/bookings/quota-service'
import { emitBookingUpdated } from '../realtime'
import { writeAudit } from '../lib/audit'

/**
 * Menandai NO_SHOW untuk booking yang hari operasionalnya sudah berakhir dan
 * truknya tidak pernah masuk gerbang. Kuota dikembalikan agar slot bisa dipakai
 * lagi.
 *
 * Patokannya akhir hari operasional, bukan `end_time` booking. Truk yang datang
 * terlambat masih boleh dipindai dan masuk `LATE_WAITING_LIST` selama gudang
 * buka — kalau booking ditandai NO_SHOW begitu jam selesainya lewat, truk yang
 * datang 10 menit setelah jadwal akan ditolak di gerbang, padahal PRD
 * menjanjikan QR tetap bisa dipindai.
 *
 * Dijalankan setiap 10 menit; tanggal operasional mengikuti Asia/Jakarta.
 */
export async function markNoShowBookings(now: Date = new Date()): Promise<number> {
  const settings = await getSettings()
  const window = toWindow(settings)

  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ['BOOKED_INCOMPLETE', 'BOOKED_READY'] },
      // Batasi ke tanggal yang mungkin sudah tutup; hari ini disaring di bawah.
      bookingDate: { lte: dateOnlyToUtc(todayISO()) },
    },
    include: { truckType: true },
    take: 200,
  })

  let marked = 0
  for (const booking of candidates) {
    const date = utcToDateOnly(booking.bookingDate)
    if (!isOperationalDayOver(date, now, window.endMinute)) continue

    await prisma.$transaction(async (tx) => {
      await releaseBlocks(tx, {
        date,
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        blocksRequired: booking.truckType.blocksRequired,
        window,
      })

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'NO_SHOW' },
      })

      await writeAudit(
        {
          userId: null,
          userRole: 'ADMIN',
          action: 'AUTO_NO_SHOW',
          bookingId: booking.id,
          meta: { detectedAt: now.toISOString(), date },
        },
        tx
      )
    })

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'NO_SHOW',
      userId: booking.customerId,
    })
    marked += 1
  }

  return marked
}

const INTERVAL_MS = 10 * 60 * 1000

export function startNoShowJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const marked = await markNoShowBookings()
      if (marked > 0) {
        // eslint-disable-next-line no-console
        console.log(`[job] ${marked} booking ditandai NO_SHOW`)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[job] no-show gagal', error)
    }
  }

  void run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return timer
}
