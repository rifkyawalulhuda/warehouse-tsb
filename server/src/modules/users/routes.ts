import { Router } from 'express'
import { z } from 'zod'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { hashPassword } from '../../lib/auth'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { writeAudit } from '../../lib/audit'
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
        // Akun customer dikelola di Master Data Customer. Menampilkannya di sini
        // membuat dua tempat mengedit hal yang sama.
        role: query.role ? (query.role as Role) : { not: 'CUSTOMER' },
        ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        customerId: true,
        canApproveBooking: true,
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
  role: roleSchema,
  password: z.string().min(7, 'Password minimal 7 karakter'),
})

usersRouter.post('/', async (req, res, next) => {
  try {
    const body = parse(createSchema, req.body, 'Data pengguna')

    // Satu pintu pembuatan akun customer. Kalau dibuat di sini, akun bisa
    // berakhir tanpa perusahaan dan tidak bisa booking sama sekali.
    if (body.role === 'CUSTOMER') {
      throw conflict(
        'CUSTOMER_VIA_MASTER',
        'Akun Customer dibuat dari Master Data Customer, bukan dari halaman Pengguna.'
      )
    }

    const exists = await prisma.user.findUnique({ where: { email: body.email } })
    if (exists) throw conflict('EMAIL_TAKEN', 'Email sudah dipakai akun lain')

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        role: body.role,
        passwordHash: await hashPassword(body.password),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        customerId: true,
        canApproveBooking: true,
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
    isActive: z.boolean().optional(),
    password: z.string().min(7, 'Password minimal 7 karakter').optional(),
    /// Hak approve untuk non-ADMIN. Role ADMIN selalu berhak tanpa flag ini.
    canApproveBooking: z.boolean().optional(),
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

    // Whitelist approval kini milik customer, bukan akun. Menerimanya di sini
    // akan membuat Admin mengira sudah mengatur sesuatu padahal tidak ada efeknya.
    if (body.canApproveBooking !== undefined && exists.role === 'ADMIN') {
      throw badRequest(
        'FLAG_NOT_APPLICABLE',
        'Admin sudah otomatis berhak menyetujui; flag tidak diperlukan'
      )
    }

    const flagsChanged =
      body.canApproveBooking !== undefined &&
      body.canApproveBooking !== exists.canApproveBooking

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.phone !== undefined ? { phone: body.phone } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
          ...(body.canApproveBooking !== undefined
            ? { canApproveBooking: body.canApproveBooking }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          customerId: true,
          canApproveBooking: true,
          createdAt: true,
        },
      })

      // Memberi/mencabut hak approve mengubah siapa yang boleh melewati
      // antrean. Itu perubahan wewenang, bukan sekadar data profil.
      if (flagsChanged) {
        await writeAudit(
          {
            userId: req.user!.id,
            userRole: req.user!.role,
            action: 'USER_APPROVAL_FLAGS_CHANGED',
            meta: {
              targetUserId: id,
              canApproveBooking: updated.canApproveBooking,
            },
          },
          tx as Tx
        )
      }

      return updated
    })

    res.json({ data: user })
  } catch (error) {
    next(error)
  }
})
