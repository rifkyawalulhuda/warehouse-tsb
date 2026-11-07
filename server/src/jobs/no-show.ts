import { prisma } from '../lib/prisma'
import { getSettings, toWindow } from '../lib/settings'
import { utcToDateOnly, minuteOfDayJakarta, todayISO } from '../lib/time'
import { releaseBlocks } from '../modules/bookings/quota-service'
import { emitBookingUpdated } from '../realtime'
import { writeAudit } from '../lib/audit'

/**
 * Menandai NO_SHOW untuk booking yang jadwalnya sudah lewat dan truknya tidak
 * pernah masuk gerbang. Kuota dikembalikan agar slot bisa dipakai lagi.
 *
 * Dijalankan setiap 10 menit; tanggal operasional mengikuti Asia/Jakarta.
 */
export async function markNoShowBookings(): Promise<number> {
  const now = new Date()
  const settings = await getSettings()
  const window = toWindow(settings)

  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ['BOOKED_INCOMPLETE', 'BOOKED_READY'] },
      endTime: { lt: now },
    },
    include: { truckType: true },
    take: 200,
  })

  let marked = 0
  for (const booking of candidates) {
    await prisma.$transaction(async (tx) => {
      await releaseBlocks(tx, {
        date: utcToDateOnly(booking.bookingDate),
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
          meta: { detectedAt: now.toISOString(), date: todayISO() },
        },
        tx
      )
    })

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'NO_SHOW',
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
