import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { conflict, notFound } from '../../lib/http-error'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { capacityMap } from '../../lib/settings'

export const masterRouter = Router()

masterRouter.use(requireAuth)

const dockActivitySchema = z.enum(['LOADING', 'UNLOADING', 'BOTH'])
const dockStatusSchema = z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'])

/* ---------------------------- Docks ---------------------------- */

masterRouter.get('/docks', async (_req, res, next) => {
  try {
    const [docks, capacities] = await Promise.all([
      prisma.dock.findMany({ orderBy: { id: 'asc' } }),
      capacityMap(),
    ])
    res.json({ data: { docks, capacities } })
  } catch (error) {
    next(error)
  }
})

const dockCreateSchema = z.object({
  dockCode: z.string().trim().min(1, 'Kode dock wajib diisi').max(20),
  allowedActivity: dockActivitySchema,
  currentStatus: dockStatusSchema.default('AVAILABLE'),
})

masterRouter.post('/docks', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(dockCreateSchema, req.body, 'Data dock')
    const exists = await prisma.dock.findUnique({ where: { dockCode: body.dockCode } })
    if (exists) throw conflict('DOCK_CODE_TAKEN', 'Kode dock sudah dipakai')

    const dock = await prisma.dock.create({ data: body })
    res.status(201).json({ data: dock })
  } catch (error) {
    next(error)
  }
})

const dockUpdateSchema = z.object({
  dockCode: z.string().trim().min(1).max(20).optional(),
  allowedActivity: dockActivitySchema.optional(),
  currentStatus: dockStatusSchema.optional(),
})

masterRouter.patch('/docks/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(dockUpdateSchema, req.body, 'Data dock')
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw notFound('Dock tidak ditemukan')

    const dock = await prisma.dock.findUnique({ where: { id } })
    if (!dock) throw notFound('Dock tidak ditemukan')

    const updated = await prisma.dock.update({ where: { id }, data: body })
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

const truckTypeSchema = z.object({
  truckName: z.string().trim().min(2, 'Nama jenis truk wajib diisi').max(80),
  durationMinutes: z.coerce.number().int().min(30).max(480),
  blocksRequired: z.coerce.number().int().min(1).max(16),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
})

masterRouter.post('/truck-types', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(truckTypeSchema, req.body, 'Jenis truk')
    const truckType = await prisma.truckType.create({ data: body })
    res.status(201).json({ data: truckType })
  } catch (error) {
    next(error)
  }
})

masterRouter.patch('/truck-types/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(truckTypeSchema.partial(), req.body, 'Jenis truk')
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw notFound('Jenis truk tidak ditemukan')

    const updated = await prisma.truckType.update({ where: { id }, data: body })
    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})
