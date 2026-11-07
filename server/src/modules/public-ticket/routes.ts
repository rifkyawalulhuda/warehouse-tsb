import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse, phoneSchema, plateSchema } from '../../lib/validate'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { getSettings, toWindow } from '../../lib/settings'
import { utcToDateOnly, minuteOfDayJakarta } from '../../lib/time'
import { emitBookingUpdated } from '../../realtime'
import { writeAudit } from '../../lib/audit'
import { bookingSelect, getBookingByQrToken, statusForVehicleData } from '../bookings/repository'

export const publicTicketRouter = Router()

/**
 * Halaman tiket supir. Tanpa login: qr_token adalah kredensialnya.
 * Hanya data yang perlu dilihat supir yang dikirim (tanpa email customer,
 * tanpa nomor internal).
 */
publicTicketRouter.get('/:qrToken', async (req, res, next) => {
  try {
    const qrToken = pathParam(req, 'qrToken')
    if (!qrToken || qrToken.length < 16) throw notFound('Tiket tidak ditemukan')

    const booking = await getBookingByQrToken(qrToken)
    if (!booking) throw notFound('Tiket tidak ditemukan')

    const settings = await getSettings()

    res.json({
      data: {
        bookingCode: booking.bookingCode,
        qrToken: booking.qrToken,
        status: booking.status,
        activityType: booking.activityType,
        bookingDate: utcToDateOnly(booking.bookingDate),
        startTime: booking.startTime,
        endTime: booking.endTime,
        referenceDocNo: booking.referenceDocNo,
        licensePlate: booking.licensePlate,
        driverName: booking.driverName,
        customerName: booking.customer.companyName ?? booking.customer.name,
        truckType: booking.truckType,
        dockCode: booking.assignedDock?.dockCode ?? null,
        lateMinutes: booking.lateMinutes,
        vehicleComplete: Boolean(booking.licensePlate && booking.driverName),
        warehouseName: settings.warehouseName,
        gracePeriodMinutes: settings.gracePeriodMinutes,
        timeLog: booking.timeLog,
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * Supir boleh melengkapi plat nomor & nama sendiri dari halaman tiket
 * (keputusan grilling: data kendaraan menyusul).
 */
publicTicketRouter.patch('/:qrToken/vehicle-info', async (req, res, next) => {
  try {
    const qrToken = pathParam(req, 'qrToken')
    if (!qrToken || qrToken.length < 16) throw notFound('Tiket tidak ditemukan')

    const body = parse(
      z.object({
        licensePlate: plateSchema.optional(),
        driverName: z.string().trim().max(120).optional(),
        driverPhone: phoneSchema.optional(),
      }),
      req.body,
      'Data kendaraan'
    )

    const booking = await prisma.booking.findUnique({
      where: { qrToken },
      include: { timeLog: true },
    })
    if (!booking) throw notFound('Tiket tidak ditemukan')

    if (!['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(booking.status)) {
      throw conflict(
        'VEHICLE_LOCKED',
        'Data kendaraan tidak bisa diubah karena truk sudah masuk gerbang'
      )
    }

    const plate = body.licensePlate?.trim() ? body.licensePlate : booking.licensePlate
    const driverName = body.driverName?.trim() ? body.driverName : booking.driverName
    const complete = Boolean(plate && driverName)

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id: booking.id },
        data: {
          licensePlate: plate,
          driverName,
          driverPhone: body.driverPhone?.trim() ? body.driverPhone : booking.driverPhone,
          status: statusForVehicleData(booking.status, complete),
        },
        select: bookingSelect,
      })

      await tx.bookingTimeLog.upsert({
        where: { bookingId: booking.id },
        create: {
          bookingId: booking.id,
          vehicleCompletedAt: complete ? new Date() : null,
        },
        update: {
          vehicleCompletedAt: complete
            ? (booking.timeLog?.vehicleCompletedAt ?? new Date())
            : null,
        },
      })

      await writeAudit(
        {
          userId: null,
          userRole: 'CUSTOMER',
          action: 'VEHICLE_INFO_UPDATED_BY_DRIVER',
          bookingId: booking.id,
          meta: { complete },
        },
        tx
      )

      return result
    })

    emitBookingUpdated({
      bookingId: updated.id,
      qrToken: updated.qrToken,
      status: updated.status,
      userId: updated.customer.id,
    })

    res.json({ data: { status: updated.status, licensePlate: updated.licensePlate } })
  } catch (error) {
    next(error)
  }
})

/** Dipakai halaman tiket untuk memastikan jam operasional masih relevan. */
publicTicketRouter.get('/:qrToken/context', async (req, res, next) => {
  try {
    const qrToken = pathParam(req, 'qrToken')
    const booking = await prisma.booking.findUnique({ where: { qrToken } })
    if (!booking) throw notFound('Tiket tidak ditemukan')

    const settings = await getSettings()
    res.json({
      data: {
        window: toWindow(settings),
        startMinute: minuteOfDayJakarta(booking.startTime),
        gracePeriodMinutes: settings.gracePeriodMinutes,
        earlyArrivalLimitMinutes: settings.earlyArrivalLimitMinutes,
      },
    })
  } catch (error) {
    next(error)
  }
})

export function assertQrToken(value: unknown): string {
  if (typeof value !== 'string' || value.length < 16) {
    throw badRequest('INVALID_QR', 'QR Code tidak dikenali')
  }
  return value
}
