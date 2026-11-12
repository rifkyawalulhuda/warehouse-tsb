import { Router } from 'express'
import { z } from 'zod'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { getSettings, capacityMap, toWindow } from '../../lib/settings'
import { listBlockStarts, minuteToLabel } from '../../lib/quota'
import { badRequest, conflict } from '../../lib/http-error'
import { writeAudit } from '../../lib/audit'

export const settingsRouter = Router()

/**
 * `warehouse_name` di pengaturan dan nama gudang pertama di tabel `warehouses`
 * adalah fakta yang sama — yang satu tercetak di tiket supir, yang lain yang
 * dipilih di Master Data Dock. Disinkronkan dua arah supaya tidak pernah ada
 * dua nama berbeda untuk gudang yang sama.
 */
const DEFAULT_WAREHOUSE_ID = 1

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
    appName: settings.appName,
    appTagline: settings.appTagline,
    appShortName: settings.appShortName,
    operatingStartMinute: settings.operatingStartMinute,
    operatingEndMinute: settings.operatingEndMinute,
    operatingStartLabel: minuteToLabel(settings.operatingStartMinute),
    operatingEndLabel: minuteToLabel(settings.operatingEndMinute),
    slotUnitMinutes: settings.slotUnitMinutes,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    earlyArrivalLimitMinutes: settings.earlyArrivalLimitMinutes,
    bookingWindowDays: settings.bookingWindowDays,
    approvalMode: settings.approvalMode,
    approvalLeadMinutes: settings.approvalLeadMinutes,
    approvalMinDecisionMinutes: settings.approvalMinDecisionMinutes,
    approvalUrgentBufferMinutes: settings.approvalUrgentBufferMinutes,
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
  // Batas panjang mengikuti kolom database: lebih baik ditolak di sini dengan
  // pesan jelas daripada gagal saat menyimpan.
  appName: z.string().trim().min(1).max(60).optional(),
  appTagline: z.string().trim().max(80).optional(),
  // Null/"" melepas nama pendek, sehingga judul tab kembali memakai appName.
  appShortName: z.string().trim().max(20).nullable().optional(),
  operatingStartMinute: z.number().int().min(0).max(1439).optional(),
  operatingEndMinute: z.number().int().min(1).max(1440).optional(),
  slotUnitMinutes: z.number().int().min(15).max(120).optional(),
  gracePeriodMinutes: z.number().int().min(0).max(240).optional(),
  earlyArrivalLimitMinutes: z.number().int().min(0).max(480).optional(),
  bookingWindowDays: z.number().int().min(1).max(90).optional(),
  approvalMode: z.enum(['AUTO', 'MANUAL']).optional(),
  approvalLeadMinutes: z.number().int().min(5).max(2880).optional(),
  approvalMinDecisionMinutes: z.number().int().min(5).max(1440).optional(),
  approvalUrgentBufferMinutes: z.number().int().min(0).max(14400).optional(),
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

    if (body.warehouseName !== undefined) {
      const taken = await prisma.warehouse.findFirst({
        where: { name: body.warehouseName, id: { not: DEFAULT_WAREHOUSE_ID } },
      })
      if (taken) throw conflict('WAREHOUSE_NAME_TAKEN', 'Nama gudang sudah dipakai')
    }

    // Dalam satu transaksi: kalau penamaan gudang gagal, pengaturan tidak
    // boleh ikut berubah supaya kedua tempat tidak berakhir beda nama.
    await prisma.$transaction(async (tx) => {
      const data = { ...body }
      // String kosong dari formulir berarti "tidak ada", bukan nama pendek
      // sepanjang satu spasi.
      if (data.appShortName !== undefined) {
        data.appShortName = data.appShortName?.trim() ? data.appShortName.trim() : null
      }
      await tx.warehouseSetting.update({ where: { id: current.id }, data })
      if (body.warehouseName !== undefined) {
        await tx.warehouse.updateMany({
          where: { id: DEFAULT_WAREHOUSE_ID },
          data: { name: body.warehouseName },
        })
      }

      // Perubahan mode approval mengubah siapa yang boleh booking tanpa antre.
      // Ini keputusan bisnis kritis: tanpa audit, tidak ada jawaban saat ditanya
      // "siapa yang mematikan auto-approve kemarin?". Lihat rencana §4.13.
      if (body.approvalMode !== undefined && body.approvalMode !== current.approvalMode) {
        await writeAudit(
          {
            userId: req.user!.id,
            userRole: req.user!.role,
            action: 'APPROVAL_MODE_CHANGED',
            meta: { from: current.approvalMode, to: body.approvalMode },
          },
          tx as Tx
        )
      }
    })

    res.json({ data: await settingsPayload() })
  } catch (error) {
    next(error)
  }
})
