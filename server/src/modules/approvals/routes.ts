import { Router } from 'express'
import { z } from 'zod'
import type { ApprovalStatus } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireApprover } from '../../middleware/auth'
import { badRequest, conflict } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { getSettings, toWindow } from '../../lib/settings'
import { minuteOfDayJakarta, utcToDateOnly } from '../../lib/time'
import { finalizeRelease } from '../bookings/quota-service'
import { bookingSelect } from '../bookings/repository'
import { emitBookingUpdated } from '../../realtime'
import { writeAudit } from '../../lib/audit'

export const approvalsRouter = Router()

approvalsRouter.use(requireAuth, requireApprover)

/* ------------------------------------------------------------------ */
/* Daftar antrean                                                      */
/* ------------------------------------------------------------------ */

approvalsRouter.get('/', async (req, res, next) => {
  try {
    const query = parse(
      z.object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']).default('PENDING'),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
      }),
      req.query,
      'Filter persetujuan'
    )

    const bookings = await prisma.booking.findMany({
      where: {
        approvalStatus: query.status as ApprovalStatus,
        ...(query.date
          ? { bookingDate: new Date(`${query.date}T00:00:00.000Z`) }
          : {}),
      },
      select: bookingSelect,
      // Tenggat paling dekat lebih dulu: antrean ini adalah daftar kerja, bukan arsip.
      orderBy: [{ approvalDeadline: 'asc' }, { startTime: 'asc' }],
      take: query.limit,
    })

    res.json({
      data: {
        status: query.status,
        total: bookings.length,
        bookings,
      },
    })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Setujui                                                             */
/* ------------------------------------------------------------------ */

/**
 * Compare-and-set, bukan SELECT ... FOR UPDATE.
 *
 * Job expire dan Admin bisa menyentuh booking yang sama di detik yang sama.
 * Syarat `approval_status = 'PENDING'` di dalam UPDATE memastikan hanya satu
 * yang menang, tanpa menahan lock lebih lama daripada yang diperlukan —
 * transaksi ini juga memegang baris kuota.
 */
async function claimApproval(
  tx: Tx,
  bookingId: string,
  approverId: string
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE bookings
    SET approval_status = 'APPROVED',
        approved_by_id = ${approverId}::uuid,
        approved_at = now()
    WHERE id = ${bookingId}::uuid
      AND approval_status = 'PENDING'
      AND status IN ('BOOKED_INCOMPLETE', 'BOOKED_READY')
    RETURNING id
  `
  return rows.length > 0
}

approvalsRouter.post('/:id/approve', async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID booking tidak valid')
    const user = req.user!

    const existing = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, approvalStatus: true, status: true },
    })
    if (!existing) throw badRequest('NOT_FOUND', 'Booking tidak ditemukan')

    if (existing.approvalStatus !== 'PENDING') {
      throw conflict(
        'APPROVAL_ALREADY_DECIDED',
        'Booking ini sudah diputuskan atau kedaluwarsa'
      )
    }
    if (!['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(existing.status)) {
      throw conflict(
        'APPROVAL_NOT_APPLICABLE',
        'Booking ini sudah dibatalkan atau diproses, tidak bisa disetujui'
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const won = await claimApproval(tx, id, user.id)
      if (!won) return null

      await writeAudit(
        {
          userId: user.id,
          userRole: user.role,
          action: 'BOOKING_APPROVED',
          bookingId: id,
        },
        tx
      )

      return tx.booking.findUnique({ where: { id }, select: bookingSelect })
    })

    if (!updated) {
      throw conflict(
        'APPROVAL_ALREADY_DECIDED',
        'Booking ini sudah diputuskan atau kedaluwarsa'
      )
    }

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
/* Tolak                                                               */
/* ------------------------------------------------------------------ */

approvalsRouter.post('/:id/reject', async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID booking tidak valid')

    const body = parse(
      z.object({
        // Alasan wajib: tanpa itu customer tidak tahu apa yang harus diperbaiki
        // dan akan mengulang kesalahan yang sama.
        reason: z.string().trim().min(5, 'Alasan penolakan wajib diisi').max(240),
      }),
      req.body,
      'Alasan penolakan'
    )

    const user = req.user!
    const booking = await prisma.booking.findUnique({ where: { id } })
    if (!booking) throw badRequest('NOT_FOUND', 'Booking tidak ditemukan')

    if (booking.approvalStatus !== 'PENDING') {
      throw conflict(
        'APPROVAL_ALREADY_DECIDED',
        'Booking ini sudah diputuskan atau kedaluwarsa'
      )
    }

    const settings = await getSettings()
    const window = toWindow(settings)

    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE bookings
        SET approval_status = 'REJECTED',
            status = 'CANCELLED',
            approved_by_id = ${user.id}::uuid,
            approved_at = now(),
            rejection_reason = ${body.reason}
        WHERE id = ${id}::uuid
          AND approval_status = 'PENDING'
        RETURNING id
      `
      if (rows.length === 0) return null

      // Tolak = booking berakhir. Kuota harus kembali lewat satu-satunya
      // pintu pelepasan, bukan lewat releaseBlocks langsung.
      await finalizeRelease(tx, {
        bookingId: id,
        date: utcToDateOnly(booking.bookingDate),
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        blocksRequired: booking.blocksLocked,
        window,
      })

      await writeAudit(
        {
          userId: user.id,
          userRole: user.role,
          action: 'BOOKING_REJECTED',
          bookingId: id,
          meta: { reason: body.reason },
        },
        tx as Tx
      )

      return tx.booking.findUnique({ where: { id }, select: bookingSelect })
    })

    if (!updated) {
      throw conflict(
        'APPROVAL_ALREADY_DECIDED',
        'Booking ini sudah diputuskan atau kedaluwarsa'
      )
    }

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
/* Setujui massal                                                      */
/* ------------------------------------------------------------------ */

approvalsRouter.post('/batch-approve', async (req, res, next) => {
  try {
    const body = parse(
      z.object({
        // Dibatasi 50: batch adalah alat kerja harian, bukan impor massal.
        ids: z.array(z.uuid()).min(1).max(50),
      }),
      req.body,
      'Pilihan persetujuan'
    )
    const user = req.user!

    // Setiap id diproses independen, BUKAN satu transaksi besar. Bila satu
    // booking sudah kedaluwarsa, sisanya tetap disetujui — Admin melihat
    // mana yang terlewat, bukan mengulang seluruh batch.
    const approved: string[] = []
    const skipped: { id: string; reason: string }[] = []

    for (const id of new Set(body.ids)) {
      const updated = await prisma.$transaction(async (tx) => {
        const won = await claimApproval(tx, id, user.id)
        if (!won) return null

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            action: 'BOOKING_APPROVED',
            bookingId: id,
            meta: { batch: true },
          },
          tx
        )

        return tx.booking.findUnique({ where: { id }, select: bookingSelect })
      })

      if (!updated) {
        skipped.push({ id, reason: 'ALREADY_DECIDED' })
        continue
      }

      approved.push(id)
      emitBookingUpdated({
        bookingId: updated.id,
        qrToken: updated.qrToken,
        status: updated.status,
        customerId: updated.customer.id,
      })
    }

    await writeAudit({
      userId: user.id,
      userRole: user.role,
      action: 'APPROVAL_BATCH_PROCESSED',
      meta: { approved: approved.length, skipped: skipped.length },
    })

    res.json({ data: { approved, skipped } })
  } catch (error) {
    next(error)
  }
})
