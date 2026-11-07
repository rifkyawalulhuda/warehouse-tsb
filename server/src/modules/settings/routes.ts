import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { getSettings, capacityMap, toWindow } from '../../lib/settings'
import { listBlockStarts, minuteToLabel } from '../../lib/quota'
import { badRequest } from '../../lib/http-error'

export const settingsRouter = Router()

/** Satu bentuk respons untuk GET dan PUT supaya UI tidak perlu dua tipe. */
async function settingsPayload() {
  const settings = await getSettings()
  const [truckTypes, capacities] = await Promise.all([
    prisma.truckType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    capacityMap(),
  ])

  const window = toWindow(settings)

  return {
    warehouseName: settings.warehouseName,
    operatingStartMinute: settings.operatingStartMinute,
    operatingEndMinute: settings.operatingEndMinute,
    operatingStartLabel: minuteToLabel(settings.operatingStartMinute),
    operatingEndLabel: minuteToLabel(settings.operatingEndMinute),
    slotUnitMinutes: settings.slotUnitMinutes,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    earlyArrivalLimitMinutes: settings.earlyArrivalLimitMinutes,
    bookingWindowDays: settings.bookingWindowDays,
    capacity: capacities,
    blocksPerDay: listBlockStarts(window).length,
    truckTypes,
  }
}

settingsRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    res.json({ data: await settingsPayload() })
  } catch (error) {
    next(error)
  }
})

const updateSchema = z.object({
  warehouseName: z.string().trim().min(2).max(120).optional(),
  operatingStartMinute: z.number().int().min(0).max(1439).optional(),
  operatingEndMinute: z.number().int().min(1).max(1440).optional(),
  slotUnitMinutes: z.number().int().min(15).max(120).optional(),
  gracePeriodMinutes: z.number().int().min(0).max(240).optional(),
  earlyArrivalLimitMinutes: z.number().int().min(0).max(480).optional(),
  bookingWindowDays: z.number().int().min(1).max(90).optional(),
})

settingsRouter.put('/', requireAuth, requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(updateSchema, req.body, 'Pengaturan')
    const current = await getSettings()

    const startMinute = body.operatingStartMinute ?? current.operatingStartMinute
    const endMinute = body.operatingEndMinute ?? current.operatingEndMinute
    const unit = body.slotUnitMinutes ?? current.slotUnitMinutes

    if (endMinute <= startMinute) {
      throw badRequest('INVALID_WINDOW', 'Jam tutup harus setelah jam buka')
    }
    if ((endMinute - startMinute) % unit !== 0) {
      throw badRequest(
        'INVALID_WINDOW',
        'Rentang jam operasional harus kelipatan satuan blok'
      )
    }

    await prisma.warehouseSetting.update({ where: { id: current.id }, data: body })

    res.json({ data: await settingsPayload() })
  } catch (error) {
    next(error)
  }
})
