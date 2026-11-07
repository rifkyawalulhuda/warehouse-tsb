import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { hashPassword } from '../../lib/auth'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import type { Role } from '@prisma/client'

export const usersRouter = Router()

// Hanya Admin yang mengelola akun. Tidak ada pendaftaran publik.
usersRouter.use(requireAuth, requireExactRole('ADMIN'))

const roleSchema = z.enum(['ADMIN', 'CUSTOMER', 'GATE_OFFICER', 'CHECKER'])

usersRouter.get('/', async (req, res, next) => {
  try {
    const query = parse(
      z.object({
        role: roleSchema.optional(),
        q: z.string().trim().max(80).optional(),
        isActive: z.enum(['true', 'false']).optional(),
      }),
      req.query,
      'Filter'
    )

    const users = await prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role as Role } : {}),
        ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
                { companyName: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    res.json({ data: users })
  } catch (error) {
    next(error)
  }
})

const createSchema = z.object({
  name: z.string().trim().min(2, 'Nama wajib diisi'),
  email: z.email('Format email tidak valid').transform((v) => v.trim().toLowerCase()),
  phone: z.string().trim().max(24).optional(),
  companyName: z.string().trim().max(160).optional(),
  role: roleSchema,
  password: z.string().min(7, 'Password minimal 7 karakter'),
})

usersRouter.post('/', async (req, res, next) => {
  try {
    const body = parse(createSchema, req.body, 'Data pengguna')
    if (body.role === 'CUSTOMER' && !body.companyName) {
      throw badRequest('COMPANY_REQUIRED', 'Nama perusahaan wajib untuk akun Customer')
    }

    const exists = await prisma.user.findUnique({ where: { email: body.email } })
    if (exists) throw conflict('EMAIL_TAKEN', 'Email sudah dipakai akun lain')

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        companyName: body.companyName,
        role: body.role,
        passwordHash: await hashPassword(body.password),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    res.status(201).json({ data: user })
  } catch (error) {
    next(error)
  }
})

const updateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    phone: z.string().trim().max(24).nullable().optional(),
    companyName: z.string().trim().max(160).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(7, 'Password minimal 7 karakter').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada perubahan')

usersRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = parse(updateSchema, req.body, 'Perubahan pengguna')
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID pengguna tidak valid')

    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) throw notFound('Pengguna tidak ditemukan')

    // Admin tidak boleh menonaktifkan atau menurunkan akunnya sendiri: hanya
    // Admin yang bisa membuka kembali akun, jadi kesalahan ini mengunci sistem
    // secara permanen tanpa jalan pulih lewat aplikasi.
    if (id === req.user?.id) {
      if (body.isActive === false) {
        throw badRequest(
          'CANNOT_DEACTIVATE_SELF',
          'Anda tidak bisa menonaktifkan akun Anda sendiri'
        )
      }
    }

    // Jangan sampai tidak ada Admin aktif yang tersisa.
    if (body.isActive === false && exists.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      })
      if (activeAdmins === 0) {
        throw badRequest(
          'LAST_ADMIN',
          'Harus ada minimal satu Admin aktif. Aktifkan admin lain lebih dulu.'
        )
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        companyName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    res.json({ data: user })
  } catch (error) {
    next(error)
  }
})
