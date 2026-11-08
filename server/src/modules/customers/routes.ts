import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { hashPassword } from '../../lib/auth'
import { badRequest, conflict, notFound } from '../../lib/http-error'
import { pathParam } from '../../lib/params'
import { writeAudit } from '../../lib/audit'

export const customersRouter = Router()

customersRouter.use(requireAuth)

/**
 * Daftar ringkas untuk dropdown filter laporan. Terbuka untuk semua staf karena
 * hanya berisi nama; tanpa kontak maupun data akun.
 */
customersRouter.get('/options', async (_req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    })
    res.json({ data: customers })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Daftar & detail                                                     */
/* ------------------------------------------------------------------ */

customersRouter.get('/', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const query = parse(
      z.object({
        q: z.string().trim().max(80).optional(),
        isActive: z.enum(['true', 'false']).optional(),
      }),
      req.query,
      'Filter customer'
    )

    const customers = await prisma.customer.findMany({
      where: {
        ...(query.isActive ? { isActive: query.isActive === 'true' } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { code: { contains: query.q, mode: 'insensitive' } },
                { picName: { contains: query.q, mode: 'insensitive' } },
                { phone: { contains: query.q } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { users: true, bookings: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    })

    res.json({ data: customers })
  } catch (error) {
    next(error)
  }
})

customersRouter.get('/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID customer tidak valid')

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            canApproveBooking: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { bookings: true } },
      },
    })
    if (!customer) throw notFound('Customer tidak ditemukan')

    res.json({ data: customer })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Kode otomatis                                                       */
/* ------------------------------------------------------------------ */

/**
 * `CUST-NNN` berikutnya.
 *
 * Memakai MAX, bukan COUNT: kalau ada customer yang dihapus, COUNT akan
 * memakai ulang nomor yang pernah dipakai — dan kode customer bisa menunjuk
 * dua entitas berbeda di riwayat percakapan dengan pelanggan.
 *
 * Dipanggil di dalam transaksi yang sama dengan INSERT agar dua permintaan
 * bersamaan tidak mendapat nomor yang sama.
 */
async function nextCustomerCode(tx: Tx): Promise<string> {
  // Perhatikan `\\D`: di dalam template literal JS, `\D` akan menjadi `D`,
  // sehingga regex-nya menghapus huruf "D" alih-alih non-digit — dan CAST
  // berikutnya gagal dengan "invalid input syntax for type integer".
  const rows = await tx.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(NULLIF(regexp_replace(code, '\\D', '', 'g'), '')::int) AS max
    FROM customers
  `
  const next = (rows[0]?.max ?? 0) + 1
  return `CUST-${String(next).padStart(3, '0')}`
}

/* ------------------------------------------------------------------ */
/* Buat & ubah                                                         */
/* ------------------------------------------------------------------ */

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nama perusahaan wajib diisi').max(160),
  address: z.string().trim().max(240).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  picName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(24).nullable().optional(),
  email: z.string().trim().max(160).nullable().optional(),
  taxId: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
  autoApproveBooking: z.boolean().optional(),
})

/** Nama perusahaan unik tanpa memandang huruf besar/kecil. */
async function assertNameFree(
  name: string,
  excludeId?: string
): Promise<void> {
  const taken = await prisma.customer.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (taken) throw conflict('CUSTOMER_NAME_TAKEN', 'Nama perusahaan sudah dipakai')
}

customersRouter.post('/', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(profileSchema, req.body, 'Data customer')
    await assertNameFree(body.name)

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: { ...body, code: await nextCustomerCode(tx) },
      })

      await writeAudit(
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          action: 'CUSTOMER_CREATED',
          meta: { customerId: created.id, name: created.name, code: created.code },
        },
        tx
      )

      return created
    })

    res.status(201).json({ data: customer })
  } catch (error) {
    next(error)
  }
})

customersRouter.patch('/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID customer tidak valid')

    const body = parse(profileSchema.partial(), req.body, 'Data customer')
    if (Object.keys(body).length === 0) {
      throw badRequest('NO_CHANGES', 'Tidak ada perubahan')
    }

    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) throw notFound('Customer tidak ditemukan')
    if (body.name !== undefined) await assertNameFree(body.name, id)

    const approvalChanged =
      body.autoApproveBooking !== undefined &&
      body.autoApproveBooking !== existing.autoApproveBooking
    const deactivated = body.isActive === false && existing.isActive

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.customer.update({ where: { id }, data: body })

      await writeAudit(
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          action: deactivated ? 'CUSTOMER_DEACTIVATED' : 'CUSTOMER_UPDATED',
          meta: { customerId: id, fields: Object.keys(body) },
        },
        tx
      )

      if (approvalChanged) {
        await writeAudit(
          {
            userId: req.user!.id,
            userRole: req.user!.role,
            action: 'CUSTOMER_APPROVAL_FLAG_CHANGED',
            meta: { customerId: id, autoApproveBooking: body.autoApproveBooking },
          },
          tx
        )
      }

      return result
    })

    res.json({ data: updated })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Hapus                                                               */
/* ------------------------------------------------------------------ */

customersRouter.delete('/:id', requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const id = pathParam(req, 'id')
    if (!id) throw badRequest('INVALID_ID', 'ID customer tidak valid')

    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { users: true, bookings: true } } },
    })
    if (!existing) throw notFound('Customer tidak ditemukan')

    // Hapus hanya bila benar-benar kosong. Menghapus customer yang punya
    // booking akan memutus riwayat laporan; nonaktifkan saja.
    if (existing._count.bookings > 0) {
      throw conflict(
        'CUSTOMER_IN_USE',
        `Customer ini punya ${existing._count.bookings} booking. Nonaktifkan saja agar riwayat tetap utuh.`
      )
    }
    if (existing._count.users > 0) {
      throw conflict(
        'CUSTOMER_IN_USE',
        `Customer ini masih punya ${existing._count.users} akun login. Hapus atau pindahkan akunnya dulu.`
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.customer.delete({ where: { id } })
      await writeAudit(
        {
          userId: req.user!.id,
          userRole: req.user!.role,
          action: 'CUSTOMER_DELETED',
          meta: { customerId: id, name: existing.name, code: existing.code },
        },
        tx
      )
    })

    res.json({ data: { id, deleted: true } })
  } catch (error) {
    next(error)
  }
})

/* ------------------------------------------------------------------ */
/* Akun login milik customer                                           */
/* ------------------------------------------------------------------ */

const accountCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama wajib diisi').max(120),
  email: z.email('Format email tidak valid').transform((v) => v.trim().toLowerCase()),
  phone: z.string().trim().max(24).optional(),
  password: z.string().min(7, 'Password minimal 7 karakter'),
})

customersRouter.post(
  '/:id/users',
  requireExactRole('ADMIN'),
  async (req, res, next) => {
    try {
      const id = pathParam(req, 'id')
      if (!id) throw badRequest('INVALID_ID', 'ID customer tidak valid')

      const body = parse(accountCreateSchema, req.body, 'Akun customer')
      const customer = await prisma.customer.findUnique({
        where: { id },
        select: { id: true, name: true, isActive: true },
      })
      if (!customer) throw notFound('Customer tidak ditemukan')
      if (!customer.isActive) {
        throw conflict(
          'CUSTOMER_INACTIVE',
          'Customer sedang nonaktif. Aktifkan dulu sebelum menambah akun.'
        )
      }

      const exists = await prisma.user.findUnique({ where: { email: body.email } })
      if (exists) throw conflict('EMAIL_TAKEN', 'Email sudah dipakai akun lain')

      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          role: 'CUSTOMER',
          customerId: id,
          passwordHash: await hashPassword(body.password),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          isActive: true,
          canApproveBooking: true,
          createdAt: true,
        },
      })

      await writeAudit({
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'CUSTOMER_ACCOUNT_CREATED',
        meta: { customerId: id, userId: user.id, email: user.email },
      })

      res.status(201).json({ data: user })
    } catch (error) {
      next(error)
    }
  }
)

const accountUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: z.string().trim().max(24).nullable().optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(7, 'Password minimal 7 karakter').optional(),
    canApproveBooking: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada perubahan')

customersRouter.patch(
  '/:id/users/:userId',
  requireExactRole('ADMIN'),
  async (req, res, next) => {
    try {
      const id = pathParam(req, 'id')
      const userId = pathParam(req, 'userId')
      if (!id || !userId) throw badRequest('INVALID_ID', 'ID tidak valid')

      const body = parse(accountUpdateSchema, req.body, 'Akun customer')
      const user = await prisma.user.findFirst({
        where: { id: userId, customerId: id },
      })
      if (!user) throw notFound('Akun tidak ditemukan pada customer ini')

      const flagsChanged =
        body.canApproveBooking !== undefined &&
        body.canApproveBooking !== user.canApproveBooking

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.user.update({
          where: { id: userId },
          data: {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            ...(body.canApproveBooking !== undefined
              ? { canApproveBooking: body.canApproveBooking }
              : {}),
            ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            canApproveBooking: true,
            createdAt: true,
          },
        })

        if (flagsChanged) {
          await writeAudit(
          {
            userId: req.user!.id,
            userRole: req.user!.role,
            action: 'USER_APPROVAL_FLAGS_CHANGED',
            meta: { targetUserId: userId, canApproveBooking: result.canApproveBooking },
          },
          tx
        )
        }

        return result
      })

      res.json({ data: updated })
    } catch (error) {
      next(error)
    }
  }
)

/** Dipakai tempat lain untuk memastikan customer ada dan aktif. */
export async function assertActiveCustomer(customerId: string | null): Promise<void> {
  if (!customerId) {
    throw badRequest(
      'CUSTOMER_REQUIRED',
      'Akun ini belum terhubung ke customer. Hubungi Admin gudang.'
    )
  }
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { isActive: true },
  })
  if (!customer) throw notFound('Customer tidak ditemukan')
  if (!customer.isActive) {
    throw conflict('CUSTOMER_INACTIVE', 'Akun customer ini sedang nonaktif.')
  }
}

export type CustomerWithCounts = Prisma.CustomerGetPayload<{
  include: { _count: { select: { users: true; bookings: true } } }
}>
