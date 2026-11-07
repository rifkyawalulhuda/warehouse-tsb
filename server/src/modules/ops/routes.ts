import { Router } from 'express'
import { z } from 'zod'
import type { BookingStatus } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { requireAuth, requireRole } from '../../middleware/auth'
import { getSettings, toWindow } from '../../lib/settings'
import { utcToDateOnly, minuteOfDayJakarta, todayISO } from '../../lib/time'
import { emitBookingUpdated, emitDockUpdated } from '../../realtime'
import { writeAudit } from '../../lib/audit'
import { bookingSelect, ACTIVE_STATUSES, getBookingByQrToken } from '../bookings/repository'
import { releaseBlocks } from '../bookings/quota-service'

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

async function loadBookingByQr(qrToken: string) {
  const booking = await prisma.booking.findUnique({
    where: { qrToken },
    include: { timeLog: true, truckType: true, assignedDock: true },
  })
  if (!booking) throw notFound('QR Code tidak dikenali atau tiket sudah tidak berlaku')
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
/* Scan: hanya membaca data, tidak mengubah apa pun                    */
/* ------------------------------------------------------------------ */

opsRouter.get('/scan/:qrToken', requireRole('GATE_OFFICER', 'CHECKER'), async (req, res, next) => {
  try {
    const qrToken = pathParam(req, 'qrToken')
    if (!qrToken) throw badRequest('INVALID_QR', 'QR Code tidak dikenali')

    const booking = await getBookingByQrToken(qrToken)
    if (!booking) throw notFound('QR Code tidak dikenali atau tiket sudah tidak berlaku')

    const settings = await getSettings()
    const now = new Date()
    const earlyMinutes = Math.floor(
      (booking.startTime.getTime() - now.getTime()) / 60_000
    )
    const lateMinutes = Math.max(
      0,
      Math.floor((now.getTime() - booking.startTime.getTime()) / 60_000)
    )

    res.json({
      data: {
        booking,
        canGateIn:
          ['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(booking.status) &&
          earlyMinutes <= settings.earlyArrivalLimitMinutes,
        earlyArrival:
          earlyMinutes > settings.earlyArrivalLimitMinutes
            ? {
                minutesTooEarly: earlyMinutes,
                limitMinutes: settings.earlyArrivalLimitMinutes,
                message: `Truk datang ${earlyMinutes} menit lebih awal. Batas kedatangan awal ${settings.earlyArrivalLimitMinutes} menit.`,
              }
            : null,
        vehicleIncomplete: !(booking.licensePlate && booking.driverName),
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

      const booking = await loadBookingByQr(body.qrToken)
      assertStatus(
        booking,
        ['BOOKED_INCOMPLETE', 'BOOKED_READY'],
        'melakukan gate-in'
      )

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
      userId: updated.customer.id,
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
      userId: updated.customer.id,
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
      userId: updated.customer.id,
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
      userId: updated.customer.id,
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

    const booking = await loadBookingByQr(body.qrToken)
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
      userId: updated.customer.id,
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
      await releaseBlocks(tx, {
        date: utcToDateOnly(booking.bookingDate),
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        blocksRequired: booking.truckType.blocksRequired,
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
      userId: updated.customer.id,
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
            customer: { select: { companyName: true, name: true } },
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
        customer: log.booking?.customer
          ? (log.booking.customer.companyName ?? log.booking.customer.name)
          : null,
        meta: log.meta,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export type { OpsActor }
