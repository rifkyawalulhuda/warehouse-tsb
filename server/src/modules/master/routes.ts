import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { conflict, notFound } from '../../lib/http-error'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { capacityMap, getSettings } from '../../lib/settings'

export const masterRouter = Router()

masterRouter.use(requireAuth)

/**
 * Gudang pertama adalah gudang yang namanya juga dipakai di pengaturan
 * (`warehouse_settings.warehouse_name`) untuk dicetak di tiket supir.
 * Menamainya di satu tempat ikut mengubah yang lain — lihat settings routes.
 */
const DEFAULT_WAREHOUSE_ID = 1

masterRouter.get('/docks', async (_req, res, next) => {
  try {
    const [docks, capacities] = await Promise.all([
      prisma.dock.findMany({
        orderBy: { id: 'asc' },
        include: { warehouse: { select: { id: true, name: true } } },
      }),
      capacityMap(),
    ])
    res.json({ data: { docks, capacities } })
  } catch (error) {
    next(error)
  }
})

const dockActivitySchema = z.enum(['LOADING', 'UNLOADING', 'BOTH'])
const dockStatusSchema = z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'])

/** Nama area bersifat teks bebas — kosongkan untuk menghapusnya. */
const areaNameSchema = z
  .string()
  .trim()
  .max(80, 'Nama area maksimal 80 karakter')
  .nullable()
  .optional()

const dockCreateSchema = z.object({
  dockCode: z.string().trim().min(1, 'Kode dock wajib diisi').max(20),
  allowedActivity: dockActivitySchema,
  currentStatus: dockStatusSchema.default('AVAILABLE'),
  areaName: areaNameSchema,
  warehouseId: z.coerce.number().int().positive('Gudang wajib dipilih'),
})

masterRouter.post('/docks', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(dockCreateSchema, req.body, 'Data dock')
    const exists = await prisma.dock.findUnique({ where: { dockCode: body.dockCode } })
    if (exists) throw conflict('DOCK_CODE_TAKEN', 'Kode dock sudah dipakai')
    await assertWarehouseExists(body.warehouseId)

    const dock = await prisma.dock.create({
      data: body,
      include: { warehouse: { select: { id: true, name: true } } },
    })
    res.status(201).json({ data: dock })
  } catch (error) {
    next(error)
  }
})

const dockUpdateSchema = z.object({
  dockCode: z.string().trim().min(1).max(20).optional(),
  allowedActivity: dockActivitySchema.optional(),
  currentStatus: dockStatusSchema.optional(),
  areaName: areaNameSchema,
  warehouseId: z.coerce.number().int().positive('Gudang wajib dipilih').optional(),
})

masterRouter.patch('/docks/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(dockUpdateSchema, req.body, 'Data dock')
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw notFound('Dock tidak ditemukan')

    const dock = await prisma.dock.findUnique({ where: { id } })
    if (!dock) throw notFound('Dock tidak ditemukan')
    if (body.warehouseId !== undefined) await assertWarehouseExists(body.warehouseId)

    const updated = await prisma.dock.update({
      where: { id },
      data: body,
      include: { warehouse: { select: { id: true, name: true } } },
    })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

async function assertWarehouseExists(warehouseId: number): Promise<void> {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } })
  if (!warehouse) throw notFound('Gudang tidak ditemukan')
}

/* --------------------------- Warehouses -------------------------- */

/**
 * Daftar gudang hanya dipakai sebagai sumber pilihan di Master Data Dock.
 * Kuota dan laporan tidak membedakan gudang — lihat catatan di schema.prisma.
 */
masterRouter.get('/warehouses', async (_req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
      include: { _count: { select: { docks: true } } },
    })
    res.json({ data: warehouses })
  } catch (error) {
    next(error)
  }
})

const warehouseCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama gudang wajib diisi').max(120),
})

masterRouter.post('/warehouses', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(warehouseCreateSchema, req.body, 'Gudang')
    const exists = await prisma.warehouse.findUnique({ where: { name: body.name } })
    if (exists) throw conflict('WAREHOUSE_NAME_TAKEN', 'Nama gudang sudah dipakai')

    const warehouse = await prisma.warehouse.create({ data: body })
    res.status(201).json({ data: warehouse })
  } catch (error) {
    next(error)
  }
})

const warehouseUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
})

masterRouter.patch('/warehouses/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(warehouseUpdateSchema, req.body, 'Gudang')
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw notFound('Gudang tidak ditemukan')

    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing) throw notFound('Gudang tidak ditemukan')

    // Gudang yang masih menampung dock tidak boleh dimatikan: dock adalah
    // entitas yang selalu berada di satu gudang, jadi tidak ada tempat
    // untuk memindahkannya tanpa mengubah dock satu per satu.
    if (body.isActive === false) {
      const dockCount = await prisma.dock.count({ where: { warehouseId: id } })
      if (dockCount > 0) {
        throw conflict(
          'WAREHOUSE_IN_USE',
          `Masih ada ${dockCount} dock di gudang ini. Pindahkan dulu sebelum mematikan.`,
        )
      }
    }

    if (body.name !== undefined) {
      const taken = await prisma.warehouse.findUnique({ where: { name: body.name } })
      if (taken && taken.id !== id) throw conflict('WAREHOUSE_NAME_TAKEN', 'Nama gudang sudah dipakai')
    }

    // Gudang pertama adalah gudang yang namanya juga tercetak di tiket supir
    // (lihat catatan di schema.prisma), jadi keduanya diubah bersamaan.
    const updated = await prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.update({ where: { id }, data: body })
      if (id === DEFAULT_WAREHOUSE_ID && body.name !== undefined) {
        await tx.warehouseSetting.update({ where: { id: DEFAULT_WAREHOUSE_ID }, data: { warehouseName: body.name } })
      }
      return warehouse
    })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

/* -------------------------- Truck types ------------------------ */

masterRouter.get('/truck-types', async (_req, res, next) => {
  try {
    const truckTypes = await prisma.truckType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    res.json({ data: truckTypes })
  } catch (error) {
    next(error)
  }
})

const truckTypeInputSchema = z.object({
  truckName: z.string().trim().min(2, 'Nama jenis truk wajib diisi').max(80),
  durationMinutes: z.coerce.number().int().min(30).max(480),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
})

/**
 * `blocks_required` tidak pernah dikirim klien. Selalu diturunkan dari durasi
 * supaya angka yang dipakai mesin kuota dan yang ditampilkan di UI tidak bisa
 * berbeda — sebelumnya klien mengirimnya bebas sehingga 90 menit bisa tercatat
 * sebagai 2 blok padahal mesin mengunci 3.
 */
async function blocksForDuration(durationMinutes: number): Promise<number> {
  const settings = await getSettings()
  return Math.max(1, Math.ceil(durationMinutes / settings.slotUnitMinutes))
}

masterRouter.post('/truck-types', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(truckTypeInputSchema, req.body, 'Jenis truk')
    const truckType = await prisma.truckType.create({
      data: { ...body, blocksRequired: await blocksForDuration(body.durationMinutes) },
    })
    res.status(201).json({ data: truckType })
  } catch (error) {
    next(error)
  }
})

masterRouter.patch('/truck-types/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(truckTypeInputSchema.partial(), req.body, 'Jenis truk')
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw notFound('Jenis truk tidak ditemukan')

    const existing = await prisma.truckType.findUnique({ where: { id } })
    if (!existing) throw notFound('Jenis truk tidak ditemukan')

    // Durasi baru menentukan blok baru; kalau durasi tidak ikut diubah, blok
    // lama dipertahankan apa adanya.
    const durationMinutes = body.durationMinutes ?? existing.durationMinutes
    const blocksRequired =
      body.durationMinutes === undefined
        ? existing.blocksRequired
        : await blocksForDuration(durationMinutes)

    const updated = await prisma.truckType.update({
      where: { id },
      data: { ...body, blocksRequired },
    })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})
