import { Router, type Request } from 'express'
import { z } from 'zod'
import type { BookingStatus, Prisma } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { requireAuth, requireRole } from '../../middleware/auth'
import { getSettings, toWindow } from '../../lib/settings'
import { utcToDateOnly, minuteOfDayJakarta, todayISO, jakartaInstant, addDaysISO, diffMinutes } from '../../lib/time'
import { emitBookingUpdated, emitDockUpdated } from '../../realtime'
import { writeAudit } from '../../lib/audit'
import { bookingSelect, ACTIVE_STATUSES, getBookingByScanInput, isBookingCode, scanInputWhere } from '../bookings/repository'
import { finalizeRelease } from '../bookings/quota-service'

export const opsRouter = Router()

opsRouter.use(requireAuth)

/* ------------------------------------------------------------------ */
/* Helper transisi status                                              */
/* ------------------------------------------------------------------ */

type OpsActor = {
  id: string
  role: 'ADMIN' | 'CUSTOMER' | 'GATE_OFFICER' | 'CHECKER'
  actingAs?: 'GATE_OFFICER' | 'CHECKER' | null
}

/**
 * Pesan galat saat masukan gate tidak menemukan booking.
 *
 * Dipisah menurut bentuk masukan supaya petugas tahu apa yang salah: kode
 * booking yang keliru ketik tidak sama dengan QR yang tidak terdaftar. Kalimat
 * "tiket sudah tidak berlaku" sengaja tidak dipakai — tiket batal atau no-show
 * tetap ditemukan, dan ditolak dengan alasan statusnya sendiri.
 */
function ticketNotFoundMessage(input: string): string {
  return isBookingCode(input)
    ? `Kode booking ${input.trim().toUpperCase()} tidak ditemukan`
    : 'QR Code tidak dikenali'
}

/**
 * Ambil booking untuk aksi gate dari isi layar gate.
 *
 * Menerima dua bentuk: token QR hasil pindai kamera, dan kode booking
 * (`TSB-YYYYMMDD-NNN`) yang diketik manual — kode itulah yang tercetak besar di
 * tiket, jadi petugas lapangan wajar mengetiknya.
 *
 * Kode booking sengaja hanya diterima di sini, bukan di tiket publik: bentuknya
 * bisa ditebak (`TSB-tanggal-urut`), sedangkan token QR adalah 24 byte acak.
 */
async function loadBookingForGate(input: string) {
  const booking = await prisma.booking.findFirst({
    where: scanInputWhere(input),
    include: { timeLog: true, truckType: true, assignedDock: true },
  })
  if (!booking) throw notFound(ticketNotFoundMessage(input))
  return booking
}

function assertStatus(booking: { status: BookingStatus }, allowed: BookingStatus[], action: string) {
  if (!allowed.includes(booking.status)) {
    throw conflict(
      'INVALID_TRANSITION',
      `Tidak bisa ${action} dari status ${booking.status}`
    )
  }
}

/* ------------------------------------------------------------------ */
/* Jejak pemindaian yang gagal                                        */
/* ------------------------------------------------------------------ */

const SCAN_DEDUPE_WINDOW_MS = 60_000

/**
 * Mencatat pemindaian yang tidak berujung aksi gate.
 *
 * Hanya dipanggil saat klien menandai `?record=1`, yaitu ketika petugas benar
 * benar memindai sesuatu. Pemanggilan ulang otomatis dari layar scan (mis.
 * menyegarkan kartu setelah gate-in) tidak ikut tercatat, supaya riwayat tidak
 * dipenuhi baris yang tidak pernah dilakukan siapa pun.
 *
 * Pengulangan dalam 60 detik diabaikan: kamera bisa mengirim token yang sama
 * dua kali untuk satu tiket, dan baris kembar hanya mengaburkan riwayat.
 */
async function recordRejectedScan(input: {
  req: Request
  qrToken: string
  reason: string
  message: string
  bookingId?: string | null
}) {
  const { req } = input
  if (req.query.record !== '1') return
  if (!req.user) return

  const since = new Date(Date.now() - SCAN_DEDUPE_WINDOW_MS)
  const duplicate = await prisma.scanAttempt.findFirst({
    where: {
      qrToken: input.qrToken,
      reason: input.reason,
      userId: req.user.id,
      createdAt: { gte: since },
    },
    select: { id: true },
  })
  if (duplicate) return

  await prisma.scanAttempt.create({
    data: {
      qrToken: input.qrToken.slice(0, 128),
      reason: input.reason.slice(0, 40),
      message: input.message.slice(0, 240),
      userId: req.user.id,
      userRole: req.user.role,
      bookingId: input.bookingId ?? null,
    },
  })
}

/**
 * Alasan sebuah tiket yang terbaca tetapi tidak bisa diproses di gate.
 *
 * Urutannya penting: status terminal lebih dulu, karena tiket batal juga bisa
 * terbaca sebagai "belum boleh masuk" bila diperiksa dengan urutan terbalik.
 */
function blockedScanReason(input: {
  status: BookingStatus
  approvalPending: boolean
  earlyArrival: boolean
  vehicleIncomplete: boolean
  earlyArrivalMessage?: string | null
}): { reason: string; message: string } | null {
  if (input.status === 'CANCELLED') {
    return { reason: 'CANCELLED', message: 'Tiket sudah dibatalkan.' }
  }
  if (input.status === 'NO_SHOW') {
    return { reason: 'NO_SHOW', message: 'Booking ditandai tidak hadir.' }
  }
  if (input.status === 'CHECKED_OUT') {
    return { reason: 'ALREADY_CHECKED_OUT', message: 'Tiket sudah selesai dipakai.' }
  }
  if (input.approvalPending) {
    return {
      reason: 'APPROVAL_PENDING',
      message: 'Booking belum disetujui Admin gudang.',
    }
  }
  if (input.earlyArrival) {
    return {
      reason: 'EARLY_ARRIVAL',
      message: input.earlyArrivalMessage ?? 'Truk datang melebihi batas kedatangan awal.',
    }
  }
  if (input.vehicleIncomplete) {
    return {
      reason: 'VEHICLE_INCOMPLETE',
      message: 'Plat nomor dan nama supir belum lengkap.',
    }
  }
  if (input.status !== 'BOOKED_INCOMPLETE' && input.status !== 'BOOKED_READY') {
    return {
      reason: 'WRONG_STATUS',
      message: `Tiket sudah diproses (status ${input.status}).`,
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Scan: hanya membaca data, tidak mengubah apa pun                    */
/* ------------------------------------------------------------------ */

opsRouter.get('/scan/:qrToken', requireRole('GATE_OFFICER', 'CHECKER'), async (req, res, next) => {
  try {
    const qrToken = pathParam(req, 'qrToken')
    if (!qrToken) throw badRequest('INVALID_QR', 'QR Code tidak dikenali')

    const booking = await getBookingByScanInput(qrToken)
    if (!booking) {
      const message = ticketNotFoundMessage(qrToken)
      await recordRejectedScan({ req, qrToken, reason: 'NOT_FOUND', message })
      throw notFound(message)
    }

    const settings = await getSettings()
    const now = new Date()
    const earlyMinutes = Math.floor(
      (booking.startTime.getTime() - now.getTime()) / 60_000
    )
    const lateMinutes = Math.max(
      0,
      Math.floor((now.getTime() - booking.startTime.getTime()) / 60_000)
    )
    const earlyArrivalMessage =
      earlyMinutes > settings.earlyArrivalLimitMinutes
        ? `Truk datang ${earlyMinutes} menit lebih awal. Batas kedatangan awal ${settings.earlyArrivalLimitMinutes} menit.`
        : null
    const canGateIn =
      ['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(booking.status) &&
      booking.approvalStatus !== 'PENDING' &&
      earlyMinutes <= settings.earlyArrivalLimitMinutes
    const blocked = canGateIn
      ? null
      : blockedScanReason({
          status: booking.status,
          approvalPending: booking.approvalStatus === 'PENDING',
          earlyArrival: earlyMinutes > settings.earlyArrivalLimitMinutes,
          vehicleIncomplete: !(booking.licensePlate && booking.driverName),
          earlyArrivalMessage,
        })

    if (blocked) {
      await recordRejectedScan({
        req,
        qrToken,
        bookingId: booking.id,
        reason: blocked.reason,
        message: blocked.message,
      })
    }

    res.json({
      data: {
        booking,
        canGateIn,
        earlyArrival:
          earlyMinutes > settings.earlyArrivalLimitMinutes
            ? {
                minutesTooEarly: earlyMinutes,
                limitMinutes: settings.earlyArrivalLimitMinutes,
                message: earlyArrivalMessage,
              }
            : null,
        vehicleIncomplete: !(booking.licensePlate && booking.driverName),
        approvalPending: booking.approvalStatus === 'PENDING',
        projectedStatus:
          lateMinutes <= settings.gracePeriodMinutes
            ? ('CHECKED_IN_ON_TIME' as const)
            : ('LATE_WAITING_LIST' as const),
        lateMinutes,
        gracePeriodMinutes: settings.gracePeriodMinutes,
      },
    })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Pindai untuk checker                                                */
/* ------------------------------------------------------------------ */

/**
 * Hasil pindai versi checker: bukan soal boleh-masuk-gate, melainkan apa yang
 * bisa dikerjakan di dock sekarang — mulai, selesai, atau menugaskan dock bila
 * truk masih menunggu. Dipisah dari `/scan` supaya checker tidak pernah
 * menerima tombol gate yang akan ditolak 403.
 */
opsRouter.get(
  '/checker/scan/:qrToken',
  requireRole('CHECKER'),
  async (req, res, next) => {
    try {
      const qrToken = pathParam(req, 'qrToken')
      if (!qrToken) throw badRequest('INVALID_QR', 'QR Code tidak dikenali')

      const booking = await getBookingByScanInput(qrToken)
      if (!booking) {
        throw notFound(ticketNotFoundMessage(qrToken))
      }

      const waiting = ['CHECKED_IN_ON_TIME', 'LATE_WAITING_LIST'].includes(
        booking.status
      )
      const gateInAt = booking.timeLog?.gateInAt ?? null

      // Posisi antrean mengikuti siapa yang lebih dulu tercatat masuk gate,
      // bukan jadwal — truk yang datang lebih awal berhak dilayani lebih dulu.
      const waitingPosition =
        waiting && gateInAt
          ? (await prisma.booking.count({
              where: {
                id: { not: booking.id },
                status: { in: ['CHECKED_IN_ON_TIME', 'LATE_WAITING_LIST'] },
                timeLog: { gateInAt: { lt: gateInAt } },
              },
            })) + 1
          : null

      const docks = await prisma.dock.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          dockCode: true,
          allowedActivity: true,
          currentStatus: true,
        },
      })

      res.json({
        data: {
          booking,
          waitingPosition,
          waitingSince: gateInAt,
          actions: {
            assignDock: waiting && booking.approvalStatus !== 'PENDING',
            start: booking.status === 'DOCK_ASSIGNED',
            finish: booking.status === 'IN_PROGRESS',
          },
          docks: docks.map((dock) => ({
            ...dock,
            eligible:
              dock.currentStatus === 'AVAILABLE' &&
              (dock.allowedActivity === 'BOTH' ||
                dock.allowedActivity === booking.activityType),
          })),
        },
      })
    } catch (error) {
      next(error)
    }
  }
)

/* ------------------------------------------------------------------ */
/* Gate-In                                                             */
/* ------------------------------------------------------------------ */

opsRouter.post(
  '/gate-in',
  requireRole('GATE_OFFICER'),
  async (req, res, next) => {
    try {
      const body = parse(z.object({ qrToken: z.string().min(16) }), req.body, 'QR')
      const user = req.user!
      const settings = await getSettings()

      const booking = await loadBookingForGate(body.qrToken)
      assertStatus(
        booking,
        ['BOOKED_INCOMPLETE', 'BOOKED_READY'],
        'melakukan gate-in'
      )

      // Dua lapis: layar Security sudah menonaktifkan tombol, tetapi server
      // tetap menolak. Booking yang belum disetujui tidak boleh masuk gudang.
      if (booking.approvalStatus === 'PENDING') {
        throw conflict(
          'APPROVAL_PENDING',
          'Booking belum disetujui Admin. Hubungi Admin gudang.'
        )
      }

      if (!booking.licensePlate || !booking.driverName) {
        throw conflict(
          'VEHICLE_INCOMPLETE',
          'Plat nomor dan nama supir belum lengkap. Minta customer atau supir melengkapi dulu.'
        )
      }

      const now = new Date()
      const minutesEarly = Math.floor((booking.startTime.getTime() - now.getTime()) / 60_000)
      if (minutesEarly > settings.earlyArrivalLimitMinutes) {
        throw conflict(
          'TOO_EARLY',
          `Truk datang ${minutesEarly} menit lebih awal. Batas ${settings.earlyArrivalLimitMinutes} menit sebelum jadwal.`
        )
      }

      const lateMinutes = Math.max(
        0,
        Math.floor((now.getTime() - booking.startTime.getTime()) / 60_000)
      )
      const nextStatus: BookingStatus =
        lateMinutes <= settings.gracePeriodMinutes
          ? 'CHECKED_IN_ON_TIME'
          : 'LATE_WAITING_LIST'

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.booking.update({
          where: { id: booking.id },
          data: { status: nextStatus, lateMinutes },
          select: bookingSelect,
        })

        await tx.bookingTimeLog.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            gateInAt: now,
            gateInBy: user.id,
            vehicleCompletedAt: now,
          },
          update: { gateInAt: now, gateInBy: user.id },
        })

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            actingAsRole: req.actingAsRole,
            action: 'GATE_IN',
            bookingId: booking.id,
            meta: { lateMinutes, status: nextStatus },
          },
          tx as Tx
        )

        return result
      })

      emitBookingUpdated({
        bookingId: updated.id,
        qrToken: updated.qrToken,
        status: updated.status,
      customerId: updated.customer.id,
      })

      res.json({ data: updated })
    } catch (error) {
      next(error)
    }
  }
)

/* ------------------------------------------------------------------ */
/* Penugasan dock                                                      */
/* ------------------------------------------------------------------ */

opsRouter.post(
  '/assign-dock',
  requireRole('CHECKER'),
  async (req, res, next) => {
    try {
      const body = parse(
        z.object({
          bookingId: z.uuid(),
          dockId: z.coerce.number().int().positive(),
        }),
        req.body,
        'Penugasan dock'
      )
      const user = req.user!

      const booking = await prisma.booking.findUnique({
        where: { id: body.bookingId },
        include: { truckType: true },
      })
      if (!booking) throw notFound('Booking tidak ditemukan')

      // Pesan khusus sebelum assertStatus: booking yang belum disetujui bukan
      // "transisi tidak valid", melainkan menunggu keputusan Admin.
      if (booking.approvalStatus === 'PENDING') {
        throw conflict(
          'APPROVAL_PENDING',
          'Booking belum disetujui Admin, belum bisa ditugaskan ke dock'
        )
      }

      assertStatus(
        booking,
        ['CHECKED_IN_ON_TIME', 'LATE_WAITING_LIST'],
        'menugaskan dock'
      )

      const dock = await prisma.dock.findUnique({ where: { id: body.dockId } })
      if (!dock) throw notFound('Dock tidak ditemukan')
      if (dock.currentStatus === 'MAINTENANCE') {
        throw conflict('DOCK_MAINTENANCE', `${dock.dockCode} sedang dalam perawatan`)
      }
      if (dock.currentStatus === 'OCCUPIED') {
        throw conflict('DOCK_OCCUPIED', `${dock.dockCode} masih dipakai truk lain`)
      }
      if (
        dock.allowedActivity !== 'BOTH' &&
        dock.allowedActivity !== booking.activityType
      ) {
        throw conflict(
          'DOCK_ACTIVITY_MISMATCH',
          `${dock.dockCode} tidak melayani aktivitas ${booking.activityType}`
        )
      }

      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        // Kunci dock agar dua checker tidak menugaskan truk berbeda ke dock yang sama.
        const locked = await tx.$queryRaw<Array<{ id: number; current_status: string }>>`
          SELECT id, current_status FROM docks WHERE id = ${dock.id} FOR UPDATE
        `
        const current = locked[0]
        if (!current || current.current_status !== 'AVAILABLE') {
          throw conflict('DOCK_OCCUPIED', `${dock.dockCode} baru saja dipakai truk lain`)
        }

        await tx.dock.update({
          where: { id: dock.id },
          data: { currentStatus: 'OCCUPIED' },
        })

        const result = await tx.booking.update({
          where: { id: booking.id },
          data: { assignedDockId: dock.id, status: 'DOCK_ASSIGNED' },
          select: bookingSelect,
        })

        await tx.bookingTimeLog.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            dockAssignedAt: now,
            dockAssignedBy: user.id,
          },
          update: { dockAssignedAt: now, dockAssignedBy: user.id },
        })

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            actingAsRole: req.actingAsRole,
            action: 'DOCK_ASSIGNED',
            bookingId: booking.id,
            meta: { dockId: dock.id, dockCode: dock.dockCode },
          },
          tx as Tx
        )

        return result
      })

      emitBookingUpdated({
        bookingId: updated.id,
        qrToken: updated.qrToken,
        status: updated.status,
      customerId: updated.customer.id,
      })
      emitDockUpdated(dock.id)

      res.json({ data: updated })
    } catch (error) {
      next(error)
    }
  }
)

/* ------------------------------------------------------------------ */
/* Mulai & selesai proses di dock                                      */
/* ------------------------------------------------------------------ */

opsRouter.post(
  '/start-process',
  requireRole('CHECKER'),
  async (req, res, next) => {
    try {
      const body = parse(
        z.object({ bookingId: z.uuid() }),
        req.body,
        'Data booking'
      )
      const user = req.user!

      const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } })
      if (!booking) throw notFound('Booking tidak ditemukan')
      assertStatus(booking, ['DOCK_ASSIGNED'], 'memulai proses')

      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'IN_PROGRESS' },
          select: bookingSelect,
        })

        await tx.bookingTimeLog.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            processStartedAt: now,
            processStartedBy: user.id,
          },
          update: { processStartedAt: now, processStartedBy: user.id },
        })

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            actingAsRole: req.actingAsRole,
            action: 'PROCESS_STARTED',
            bookingId: booking.id,
          },
          tx as Tx
        )

        return result
      })

      emitBookingUpdated({
        bookingId: updated.id,
        qrToken: updated.qrToken,
        status: updated.status,
      customerId: updated.customer.id,
      })

      res.json({ data: updated })
    } catch (error) {
      next(error)
    }
  }
)

opsRouter.post(
  '/finish-process',
  requireRole('CHECKER'),
  async (req, res, next) => {
    try {
      const body = parse(z.object({ bookingId: z.uuid() }), req.body, 'Data booking')
      const user = req.user!

      const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } })
      if (!booking) throw notFound('Booking tidak ditemukan')
      assertStatus(booking, ['IN_PROGRESS'], 'menyelesaikan proses')

      const now = new Date()
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'COMPLETED' },
          select: bookingSelect,
        })

        await tx.bookingTimeLog.upsert({
          where: { bookingId: booking.id },
          create: {
            bookingId: booking.id,
            processCompletedAt: now,
            processCompletedBy: user.id,
          },
          update: { processCompletedAt: now, processCompletedBy: user.id },
        })

        // Dock bebas begitu bongkar/muat selesai; truk masih di area menuju gerbang keluar.
        if (booking.assignedDockId) {
          await tx.dock.update({
            where: { id: booking.assignedDockId },
            data: { currentStatus: 'AVAILABLE' },
          })
        }

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            actingAsRole: req.actingAsRole,
            action: 'PROCESS_COMPLETED',
            bookingId: booking.id,
            meta: { dockId: booking.assignedDockId },
          },
          tx as Tx
        )

        return result
      })

      emitBookingUpdated({
        bookingId: updated.id,
        qrToken: updated.qrToken,
        status: updated.status,
      customerId: updated.customer.id,
      })
      if (booking.assignedDockId) emitDockUpdated(booking.assignedDockId)

      res.json({ data: updated })
    } catch (error) {
      next(error)
    }
  }
)

/* ------------------------------------------------------------------ */
/* Gate-Out                                                            */
/* ------------------------------------------------------------------ */

opsRouter.post('/gate-out', requireRole('GATE_OFFICER'), async (req, res, next) => {
  try {
    const body = parse(z.object({ qrToken: z.string().min(16) }), req.body, 'QR')
    const user = req.user!

    const booking = await loadBookingForGate(body.qrToken)
    assertStatus(booking, ['COMPLETED'], 'melakukan gate-out')

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CHECKED_OUT' },
        select: bookingSelect,
      })

      await tx.bookingTimeLog.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          gateOutAt: now,
          gateOutBy: user.id,
        },
        update: { gateOutAt: now, gateOutBy: user.id },
      })

      await writeAudit(
        {
          userId: user.id,
          userRole: user.role,
          actingAsRole: req.actingAsRole,
          action: 'GATE_OUT',
          bookingId: booking.id,
        },
        tx as Tx
      )

      return result
    })

    emitBookingUpdated({
      bookingId: updated.id,
      qrToken: updated.qrToken,
      status: updated.status,
      customerId: updated.customer.id,
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* NO_SHOW (Admin)                                                     */
/* ------------------------------------------------------------------ */

opsRouter.post('/no-show', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(z.object({ bookingId: z.uuid() }), req.body, 'Data booking')
    const user = req.user!

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      include: { truckType: true },
    })
    if (!booking) throw notFound('Booking tidak ditemukan')
    assertStatus(
      booking,
      ['BOOKED_INCOMPLETE', 'BOOKED_READY', 'CHECKED_IN_ON_TIME', 'LATE_WAITING_LIST'],
      'menandai no-show'
    )

    const settings = await getSettings()
    const window = toWindow(settings)

    const updated = await prisma.$transaction(async (tx) => {
      await finalizeRelease(tx, {
        bookingId: booking.id,
        date: utcToDateOnly(booking.bookingDate),
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        // Snapshot: jumlah blok yang dilepas harus sama dengan yang dikunci.
        blocksRequired: booking.blocksLocked,
        window,
      })

      const result = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'NO_SHOW' },
        select: bookingSelect,
      })

      if (booking.assignedDockId) {
        await tx.dock.update({
          where: { id: booking.assignedDockId },
          data: { currentStatus: 'AVAILABLE' },
        })
      }

      await writeAudit(
        {
          userId: user.id,
          userRole: user.role,
          action: 'MARKED_NO_SHOW',
          bookingId: booking.id,
        },
        tx as Tx
      )

      return result
    })

    emitBookingUpdated({
      bookingId: updated.id,
      qrToken: updated.qrToken,
      status: updated.status,
      customerId: updated.customer.id,
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Antrean & dashboard                                                 */
/* ------------------------------------------------------------------ */

opsRouter.get('/queue', requireRole('CHECKER'), async (req, res, next) => {
  try {
    const query = parse(
      z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
      req.query,
      'Filter tanggal'
    )
    const date = query.date ?? todayISO()

    const bookings = await prisma.booking.findMany({
      where: {
        bookingDate: new Date(`${date}T00:00:00.000Z`),
        status: { in: ACTIVE_STATUSES },
      },
      select: bookingSelect,
      orderBy: [{ startTime: 'asc' }],
    })

    res.json({
      data: {
        date,
        onTime: bookings.filter((b) => b.status === 'CHECKED_IN_ON_TIME'),
        late: bookings.filter((b) => b.status === 'LATE_WAITING_LIST'),
        atDock: bookings.filter((b) =>
          ['DOCK_ASSIGNED', 'IN_PROGRESS'].includes(b.status)
        ),
        upcoming: bookings.filter((b) =>
          ['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(b.status)
        ),
      },
    })
  } catch (error) {
    next(error)
  }
})

/** Daftar dock + truk yang sedang dilayani, untuk dashboard dan layar checker. */
opsRouter.get('/docks', requireRole('CHECKER'), async (_req, res, next) => {
  try {
    const docks = await prisma.dock.findMany({
      orderBy: { id: 'asc' },
      include: {
        bookings: {
          where: { status: { in: ['DOCK_ASSIGNED', 'IN_PROGRESS'] } },
          select: bookingSelect,
          take: 1,
        },
      },
    })

    res.json({
      data: docks.map((dock) => ({
        id: dock.id,
        dockCode: dock.dockCode,
        allowedActivity: dock.allowedActivity,
        currentStatus: dock.currentStatus,
        currentBooking: dock.bookings[0] ?? null,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/** Antrean kerja untuk layar /dock milik satu checker. */
opsRouter.get('/dock-worklist', requireRole('CHECKER'), async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['DOCK_ASSIGNED', 'IN_PROGRESS'] },
      },
      select: bookingSelect,
      orderBy: [{ startTime: 'asc' }],
    })

    res.json({ data: bookings })
  } catch (error) {
    next(error)
  }
})

/** Feed aktivitas terbaru dari audit log, untuk dashboard operasional. */
opsRouter.get('/activity', requireRole('CHECKER'), async (req, res, next) => {
  try {
    const query = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(50).default(12) }),
      req.query,
      'Parameter aktivitas'
    )

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        action: true,
        userRole: true,
        actingAsRole: true,
        createdAt: true,
        meta: true,
        user: { select: { name: true } },
        booking: {
          select: {
            bookingCode: true,
            licensePlate: true,
            driverName: true,
            activityType: true,
            assignedDock: { select: { dockCode: true } },
            customer: { select: { name: true } },
          },
        },
      },
    })

    res.json({
      data: logs.map((log) => ({
        id: log.id,
        action: log.action,
        userRole: log.actingAsRole ?? log.userRole,
        userName: log.user?.name ?? 'Sistem',
        createdAt: log.createdAt,
        bookingCode: log.booking?.bookingCode ?? null,
        licensePlate: log.booking?.licensePlate ?? null,
        driverName: log.booking?.driverName ?? null,
        activityType: log.booking?.activityType ?? null,
        dockCode: log.booking?.assignedDock?.dockCode ?? null,
        customer: log.booking?.customer?.name ?? null,
        meta: log.meta,
      })),
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Riwayat gate: kronologi truk yang masuk dan keluar.
 *
 * Satu baris = satu peristiwa, bukan satu booking. Truk yang masuk pukul 08:00
 * dan keluar pukul 10:00 muncul dua kali, karena petugas perlu melihat kedua
 * momen itu di urutan kejadiannya.
 *
 * Pemindaian yang ditolak sengaja tidak ikut ditampilkan — catatannya tetap
 * tersimpan di `scan_attempts` untuk audit, tetapi bukan bagian dari riwayat
 * kunjungan gate.
 *
 * Dua kueri terpisah lalu digabung di memori: tiap kueri hanya mengambil
 * `limit` baris terbaru dari jenisnya, jadi biayanya tetap terbatas walaupun
 * rentang tanggalnya lebar.
 */
opsRouter.get('/gate-history', requireRole('GATE_OFFICER', 'CHECKER'), async (req, res, next) => {
  try {
    const query = parse(
      z
        .object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD'),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD'),
          q: z.string().trim().max(60).optional(),
          limit: z.coerce.number().int().min(1).max(500).default(300),
        })
        .refine((value) => value.from <= value.to, {
          message: 'Tanggal awal tidak boleh melewati tanggal akhir',
          path: ['from'],
        }),
      req.query,
      'Parameter riwayat gate'
    )

    // `to` inklusif: batas atasnya awal hari berikutnya.
    const fromInstant = jakartaInstant(query.from, 0)
    const toInstant = jakartaInstant(addDaysISO(query.to, 1), 0)
    const search = query.q ? { contains: query.q, mode: 'insensitive' as const } : null

    const bookingFilter: Prisma.BookingWhereInput | undefined = search
      ? {
          OR: [
            { bookingCode: search },
            { licensePlate: search },
            { driverName: search },
          ],
        }
      : undefined

    const bookingPreview = {
      bookingCode: true,
      licensePlate: true,
      driverName: true,
      activityType: true,
      assignedDock: { select: { dockCode: true } },
      customer: { select: { name: true } },
    } satisfies Prisma.BookingSelect

    const [gateIns, gateOuts] = await Promise.all([
      prisma.bookingTimeLog.findMany({
        where: {
          gateInAt: { gte: fromInstant, lt: toInstant },
          ...(bookingFilter ? { booking: bookingFilter } : {}),
        },
        orderBy: { gateInAt: 'desc' },
        take: query.limit,
        select: {
          id: true,
          gateInAt: true,
          gateOutAt: true,
          booking: { select: bookingPreview },
          gateInUser: { select: { name: true, role: true } },
        },
      }),
      prisma.bookingTimeLog.findMany({
        where: {
          gateOutAt: { gte: fromInstant, lt: toInstant },
          ...(bookingFilter ? { booking: bookingFilter } : {}),
        },
        orderBy: { gateOutAt: 'desc' },
        take: query.limit,
        select: {
          id: true,
          gateInAt: true,
          gateOutAt: true,
          booking: { select: bookingPreview },
          gateOutUser: { select: { name: true, role: true } },
        },
      }),
    ])

    const rows = [
      ...gateIns.map((log) => ({
        id: `in:${log.id}`,
        event: 'GATE_IN' as const,
        at: log.gateInAt!,
        bookingCode: log.booking.bookingCode,
        customer: log.booking.customer.name,
        licensePlate: log.booking.licensePlate,
        driverName: log.booking.driverName,
        activityType: log.booking.activityType,
        dockCode: log.booking.assignedDock?.dockCode ?? null,
        gateInAt: log.gateInAt,
        gateOutAt: log.gateOutAt,
        minutesInside: diffMinutes(log.gateInAt, log.gateOutAt),
        officerName: log.gateInUser?.name ?? null,
        officerRole: log.gateInUser?.role ?? null,
      })),
      ...gateOuts.map((log) => ({
        id: `out:${log.id}`,
        event: 'GATE_OUT' as const,
        at: log.gateOutAt!,
        bookingCode: log.booking.bookingCode,
        customer: log.booking.customer.name,
        licensePlate: log.booking.licensePlate,
        driverName: log.booking.driverName,
        activityType: log.booking.activityType,
        dockCode: log.booking.assignedDock?.dockCode ?? null,
        gateInAt: log.gateInAt,
        gateOutAt: log.gateOutAt,
        minutesInside: diffMinutes(log.gateInAt, log.gateOutAt),
        officerName: log.gateOutUser?.name ?? null,
        officerRole: log.gateOutUser?.role ?? null,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime())

    res.json({
      data: {
        rows: rows.slice(0, query.limit),
        truncated: rows.length > query.limit,
        from: query.from,
        to: query.to,
      },
    })
  } catch (error) {
    next(error)
  }
})

export type { OpsActor }
