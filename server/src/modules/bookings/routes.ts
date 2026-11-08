import { Router } from 'express'
import { z } from 'zod'
import type { BookingStatus, Prisma } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import {
  activitySchema,
  dateISOSchema,
  parse,
  phoneSchema,
  plateSchema,
} from '../../lib/validate'
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { getSettings, toWindow, capacityForActivity } from '../../lib/settings'
import {
  addDaysISO,
  todayISO,
  utcToDateOnly,
  minuteOfDayJakarta,
  jakartaInstant,
} from '../../lib/time'
import { emitBookingUpdated } from '../../realtime'
import { writeAudit } from '../../lib/audit'
import {
  bookingSelect,
  buildBookingCode,
  computeApprovalDeadline,
  getBookingById,
  needsApproval,
  statusForVehicleData,
} from './repository'
import { getAvailability, finalizeRelease, reserveBlocks } from './quota-service'
import { generateQrToken } from '../../lib/auth'

export const bookingsRouter = Router()

bookingsRouter.use(requireAuth)

/* ------------------------------------------------------------------ */
/* Ketersediaan jam                                                    */
/* ------------------------------------------------------------------ */

const availabilitySchema = z.object({
  date: dateISOSchema,
  activity: activitySchema,
  truckTypeId: z.coerce.number().int().positive(),
})

bookingsRouter.get('/slots/availability', async (req, res, next) => {
  try {
    const query = parse(availabilitySchema, req.query, 'Parameter ketersediaan')
    const settings = await getSettings()
    const window = toWindow(settings)
    const today = todayISO()
    const lastDate = addDaysISO(today, settings.bookingWindowDays)

    if (query.date < today) {
      throw badRequest('DATE_IN_PAST', 'Tanggal yang dipilih sudah lewat')
    }
    if (query.date > lastDate) {
      throw badRequest(
        'DATE_TOO_FAR',
        `Pemesanan hanya dibuka sampai ${settings.bookingWindowDays} hari ke depan`
      )
    }

    const truckType = await prisma.truckType.findUnique({ where: { id: query.truckTypeId } })
    if (!truckType || !truckType.isActive) {
      throw notFound('Jenis truk tidak ditemukan')
    }

    const capacity = await capacityForActivity(query.activity)
    const slots = await getAvailability(
      {
        date: query.date,
        activity: query.activity,
        window,
        capacity,
      },
      truckType.blocksRequired
    )

    // Jam yang sudah lewat hari ini tidak bisa dipesan.
    const isToday = query.date === today
    const nowMinute = minuteOfDayJakarta(new Date())

    res.json({
      data: {
        date: query.date,
        activity: query.activity,
        capacity,
        truckType,
        slots: slots.map((slot) =>
          isToday && slot.startMinute <= nowMinute
            ? { ...slot, status: 'FULL' as const, remaining: 0, limitReason: 'Jam sudah lewat' }
            : slot
        ),
      },
    })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Membuat booking                                                     */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  bookingDate: dateISOSchema,
  activityType: activitySchema,
  truckTypeId: z.coerce.number().int().positive(),
  startMinute: z.coerce.number().int().min(0).max(1439),
  referenceDocNo: z.string().trim().min(2, 'Nomor dokumen wajib diisi').max(80),
  licensePlate: plateSchema.optional().or(z.literal('')),
  driverName: z.string().trim().max(120).optional().or(z.literal('')),
  driverPhone: phoneSchema.optional(),
})

bookingsRouter.post('/', requireExactRole('CUSTOMER'), async (req, res, next) => {
  try {
    const body = parse(createSchema, req.body, 'Data booking')
    const user = req.user!
    const settings = await getSettings()
    const window = toWindow(settings)

    const today = todayISO()
    const lastDate = addDaysISO(today, settings.bookingWindowDays)
    if (body.bookingDate < today) {
      throw badRequest('DATE_IN_PAST', 'Tanggal yang dipilih sudah lewat')
    }
    if (body.bookingDate > lastDate) {
      throw badRequest(
        'DATE_TOO_FAR',
        `Pemesanan hanya dibuka sampai ${settings.bookingWindowDays} hari ke depan`
      )
    }
    if (body.bookingDate === today && body.startMinute <= minuteOfDayJakarta(new Date())) {
      throw badRequest('SLOT_IN_PAST', 'Jam tersebut sudah lewat')
    }

    const truckType = await prisma.truckType.findUnique({ where: { id: body.truckTypeId } })
    if (!truckType || !truckType.isActive) throw notFound('Jenis truk tidak ditemukan')

    const capacity = await capacityForActivity(body.activityType)
    if (capacity <= 0) {
      throw conflict(
        'NO_DOCK',
        'Belum ada dock aktif untuk aktivitas ini. Hubungi Admin gudang.'
      )
    }

    const plate = body.licensePlate?.trim() ? body.licensePlate : null
    const driverName = body.driverName?.trim() ? body.driverName : null
    const complete = Boolean(plate && driverName)

    // Keputusan approval dievaluasi SEKALI di sini dan disimpan. Job berkala
    // tidak pernah mengevaluasi ulang, sehingga status booking tidak berubah
    // tanpa ada yang meminta (keputusan grilling 3.3).
    const approvalRequired = needsApproval({
      approvalMode: settings.approvalMode,
      role: user.role,
      autoApproveBooking: user.autoApproveBooking,
    })

    const created = await prisma.$transaction(
      async (tx) => {
        // Nomor urut per hari dikunci lebih dulu agar booking_code tetap rapi
        // walau ada beberapa customer submit bersamaan. Nilai awal diambil dari
        // jumlah booking yang sudah ada pada tanggal itu, sehingga data hasil
        // seed/import tidak membuat kode bertabrakan.
        const seqRow = await tx.$queryRaw<Array<{ last_number: number }>>`
          INSERT INTO booking_day_sequences (booking_date, last_number)
          VALUES (
            ${body.bookingDate}::date,
            (SELECT COUNT(*)::int + 1 FROM bookings WHERE booking_date = ${body.bookingDate}::date)
          )
          ON CONFLICT (booking_date)
          DO UPDATE SET last_number = booking_day_sequences.last_number + 1
          RETURNING last_number
        `
        const sequence = seqRow[0]?.last_number ?? 1

        // Angka blok yang benar-benar dikunci di sini disalin ke baris booking
        // supaya pembatalan/NO_SHOW selalu melepas tepat sejumlah itu, walau
        // admin mengubah durasi jenis truk di kemudian hari.
        const blocksLocked = truckType.blocksRequired

        await reserveBlocks(
          tx,
          {
            date: body.bookingDate,
            activity: body.activityType,
            window,
            capacity,
          },
          body.startMinute,
          blocksLocked
        )

        const startTime = jakartaInstant(body.bookingDate, body.startMinute)
        const endTime = new Date(startTime.getTime() + truckType.durationMinutes * 60_000)

        // `createdAt` dipakai bersama oleh kolom dan perhitungan tenggat supaya
        // keduanya tidak beda beberapa milidetik.
        const createdAt = new Date()
        const approvalDeadline = approvalRequired
          ? computeApprovalDeadline({
              startTime,
              createdAt,
              leadMinutes: settings.approvalLeadMinutes,
              minDecisionMinutes: settings.approvalMinDecisionMinutes,
            })
          : null

        const booking = await tx.booking.create({
          data: {
            bookingCode: buildBookingCode(body.bookingDate, sequence),
            qrToken: generateQrToken(),
            customerId: user.id,
            activityType: body.activityType,
            truckTypeId: truckType.id,
            bookingDate: new Date(`${body.bookingDate}T00:00:00.000Z`),
            startTime,
            endTime,
            referenceDocNo: body.referenceDocNo,
            licensePlate: plate,
            driverName,
            driverPhone: body.driverPhone || null,
            blocksLocked,
            status: complete ? 'BOOKED_READY' : 'BOOKED_INCOMPLETE',
            approvalStatus: approvalRequired ? 'PENDING' : 'NOT_REQUIRED',
            approvalDeadline,
            createdAt,
            timeLog: {
              create: {
                vehicleCompletedAt: complete ? new Date() : null,
              },
            },
          },
          select: bookingSelect,
        })

        await writeAudit(
          {
            userId: user.id,
            userRole: user.role,
            action: 'BOOKING_CREATED',
            bookingId: booking.id,
            meta: {
              bookingCode: booking.bookingCode,
              startMinute: body.startMinute,
              blocksRequired: blocksLocked,
              approvalStatus: booking.approvalStatus,
            },
          },
          tx as Tx
        )

        return booking
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 }
    )

    emitBookingUpdated({
      bookingId: created.id,
      qrToken: created.qrToken,
      status: created.status,
      userId: created.customer.id,
    })

    res.status(201).json({ data: created })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Daftar & detail                                                     */
/* ------------------------------------------------------------------ */

bookingsRouter.get('/my-list', requireExactRole('CUSTOMER'), async (req, res, next) => {
  try {
    const query = parse(
      z.object({
        scope: z.enum(['active', 'past', 'all']).default('active'),
      }),
      req.query,
      'Filter'
    )
    const user = req.user!

    const activeStatuses: BookingStatus[] = [
      'BOOKED_INCOMPLETE',
      'BOOKED_READY',
      'CHECKED_IN_ON_TIME',
      'LATE_WAITING_LIST',
      'DOCK_ASSIGNED',
      'IN_PROGRESS',
    ]

    const where: Prisma.BookingWhereInput = { customerId: user.id }
    if (query.scope === 'active') where.status = { in: activeStatuses }
    if (query.scope === 'past') {
      where.status = { in: ['COMPLETED', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'] }
    }

    const bookings = await prisma.booking.findMany({
      where,
      select: bookingSelect,
      orderBy: [{ startTime: query.scope === 'past' ? 'desc' : 'asc' }],
      take: 200,
    })

    res.json({ data: bookings })
  } catch (error) {
    next(error)
  }
})

bookingsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID booking tidak valid')
    const booking = await getBookingById(id)
    if (!booking) throw notFound('Booking tidak ditemukan')

    const user = req.user!
    if (user.role === 'CUSTOMER' && booking.customer.id !== user.id) {
      throw forbidden()
    }

    res.json({ data: booking })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Data kendaraan menyusul                                             */
/* ------------------------------------------------------------------ */

const vehicleSchema = z.object({
  licensePlate: plateSchema.optional(),
  driverName: z.string().trim().max(120).optional(),
  driverPhone: phoneSchema.optional(),
})

bookingsRouter.patch('/:id/vehicle-info', async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID booking tidak valid')
    const body = parse(vehicleSchema, req.body, 'Data kendaraan')

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { timeLog: true },
    })
    if (!booking) throw notFound('Booking tidak ditemukan')

    const user = req.user!
    const isOwner = booking.customerId === user.id
    if (user.role === 'CUSTOMER' && !isOwner) throw forbidden()

    // Data kendaraan hanya bermakna sebelum truk masuk gerbang.
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
        where: { id },
        data: {
          licensePlate: plate,
          driverName,
          driverPhone: body.driverPhone?.trim() ? body.driverPhone : booking.driverPhone,
          status: statusForVehicleData(booking.status, complete),
        },
        select: bookingSelect,
      })

      await tx.bookingTimeLog.upsert({
        where: { bookingId: id },
        create: {
          bookingId: id,
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
          userId: user.id,
          userRole: user.role,
          action: 'VEHICLE_INFO_UPDATED',
          bookingId: id,
          meta: { complete, licensePlate: plate },
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
/* Pembatalan                                                          */
/* ------------------------------------------------------------------ */

bookingsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID booking tidak valid')

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { truckType: true },
    })
    if (!booking) throw notFound('Booking tidak ditemukan')

    const user = req.user!
    if (user.role === 'CUSTOMER' && booking.customerId !== user.id) throw forbidden()

    // Setelah gate-in, satu-satunya jalan keluar adalah NO_SHOW.
    if (!['BOOKED_INCOMPLETE', 'BOOKED_READY'].includes(booking.status)) {
      throw conflict(
        'CANCEL_NOT_ALLOWED',
        'Booking tidak bisa dibatalkan karena truk sudah masuk gerbang'
      )
    }

    const settings = await getSettings()
    const window = toWindow(settings)

    await prisma.$transaction(async (tx) => {
      await finalizeRelease(tx, {
        bookingId: id,
        date: utcToDateOnly(booking.bookingDate),
        activity: booking.activityType,
        startMinute: minuteOfDayJakarta(booking.startTime),
        // Pakai snapshot, bukan truckType.blocksRequired: jenis truk bisa saja
        // sudah diedit sejak booking ini dibuat.
        blocksRequired: booking.blocksLocked,
        window,
      })

      await tx.booking.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      await writeAudit(
        {
          userId: user.id,
          userRole: user.role,
          action: 'BOOKING_CANCELLED',
          bookingId: id,
        },
        tx as Tx
      )
    })

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CANCELLED',
      userId: booking.customerId,
    })

    res.json({ data: { id, status: 'CANCELLED' as BookingStatus } })
  } catch (error) {
    next(error)
  }
})
