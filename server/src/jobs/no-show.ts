import { prisma } from '../lib/prisma'
import { getSettings, toWindow } from '../lib/settings'
import {
  dateOnlyToUtc,
  isOperationalDayOver,
  minuteOfDayJakarta,
  todayISO,
  utcToDateOnly,
} from '../lib/time'
import { finalizeRelease } from '../modules/bookings/quota-service'
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
      // Booking yang masih menunggu keputusan Admin adalah wilayah job expire,
      // bukan NO_SHOW. Tanpa filter ini booking PENDING akan dicap NO_SHOW dan
      // bucket KPI `expiredPending` tidak pernah terisi.
      approvalStatus: { not: 'PENDING' },
      // Batasi ke tanggal yang mungkin sudah tutup; hari ini disaring di bawah.
      bookingDate: { lte: dateOnlyToUtc(todayISO()) },
    },
    include: { truckType: true },
    // Tanpa urutan, `take` mengambil baris sembarang: bila 200 baris pertama
    // semuanya booking hari ini yang belum tutup (lalu di-`continue`), booking
    // kemarin yang benar-benar terlantar tidak pernah masuk batch — dan
    // himpunannya stabil, jadi job tidak pernah maju sampai tengah malam.
    orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    take: 200,
  })

  let marked = 0
  for (const booking of candidates) {
    const date = utcToDateOnly(booking.bookingDate)
    if (!isOperationalDayOver(date, now, window.endMinute)) continue

    try {
      const markedNow = await prisma.$transaction(async (tx) => {
        // Compare-and-set DULU, baru lepas kuota — sama seperti job approval.
        // Antara `findMany` di atas dan transaksi ini truk bisa sudah dipindai
        // masuk gerbang. UPDATE tanpa syarat akan menimpa CHECKED_IN_* dengan
        // NO_SHOW sekaligus mengembalikan kuota yang masih dipakai truk itu,
        // sehingga slotnya bisa diberikan ke booking lain.
        const updated = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE bookings
          SET status = 'NO_SHOW'
          WHERE id = ${booking.id}::uuid
            AND status IN ('BOOKED_INCOMPLETE', 'BOOKED_READY')
            AND approval_status <> 'PENDING'
          RETURNING id
        `

        if (updated.length === 0) return false

        await finalizeRelease(tx, {
          bookingId: booking.id,
          date,
          activity: booking.activityType,
          startMinute: minuteOfDayJakarta(booking.startTime),
          // Snapshot: jenis truk bisa sudah diedit sejak booking dibuat.
          blocksRequired: booking.blocksLocked,
          window,
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

        return true
      })

      if (!markedNow) continue
    } catch (error) {
      // Satu booking bermasalah tidak boleh menghentikan sisanya. Tanpa ini,
      // baris yang selalu gagal (mis. pengaturan berubah) muncul lagi di batch
      // berikutnya dan job berhenti untuk SEMUA booking, selamanya.
      // eslint-disable-next-line no-console
      console.error('[job] no-show gagal untuk booking', booking.id, error)
      continue
    }

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'NO_SHOW',
      customerId: booking.customerId,
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
