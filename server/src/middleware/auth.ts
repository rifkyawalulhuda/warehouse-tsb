import type { NextFunction, Request, Response } from 'express'
import type { Role, User } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { cookieNames, verifyAccessToken } from '../lib/auth'
import { forbidden, HttpError, unauthorized } from '../lib/http-error'

/**
 * Profil yang ikut di setiap request. `customerName` bukan kolom `User`: ia
 * diambil dari relasi supaya layar customer bisa menyebut perusahaannya tanpa
 * memanggil endpoint lain.
 */
export type RequestUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'customerId' | 'canApproveBooking'
> & { customerName: string | null }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser
      actingAsRole?: Role
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[cookieNames.access] as string | undefined
    if (!token) throw unauthorized()

    const claims = verifyAccessToken(token)
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customerId: true,
        isActive: true,
        canApproveBooking: true,
        customer: { select: { name: true } },
      },
    })
    if (!user || !user.isActive) throw unauthorized('Akun tidak aktif')

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      customerName: user.customer?.name ?? null,
      canApproveBooking: user.canApproveBooking,
    }
    next()
  } catch (error) {
    // Kesalahan token berarti sesi tidak sah. Kesalahan lain — paling sering
    // database yang sedang tidak terjangkau — bukan 401: menjawab 401 membuat
    // semua pengguna ter-logout dan menyembunyikan penyebab sebenarnya.
    if (error instanceof HttpError) return next(error)
    if (error instanceof jwt.JsonWebTokenError) return next(unauthorized())
    next(error)
  }
}

/**
 * Admin boleh melakukan aksi petugas lapangan (keputusan grilling: satu orang
 * bisa menjaga semua pos), tetapi role yang dipakai dicatat di audit log.
 */
export function requireRole(...roles: Role[]) {
  const allowed = new Set<Role>([...roles, 'ADMIN'])
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!allowed.has(req.user.role)) return next(forbidden())
    if (req.user.role === 'ADMIN' && !roles.includes('ADMIN')) {
      req.actingAsRole = roles[0]
    } else {
      req.actingAsRole = req.user.role
    }
    next()
  }
}

export function requireExactRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }
}

/**
 * Hak menyetujui booking.
 *
 * Role ADMIN selalu berhak tanpa flag, sehingga gudang tidak kehilangan
 * kemampuan memutuskan hanya karena lupa menyalakan flag. Flag
 * `can_approve_booking` hanya MENAMBAH hak ke peran lain (mis. satu Gate
 * Officer tepercaya sebagai backup saat Admin tidak masuk).
 */
export function requireApprover(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized())
  if (req.user.role === 'ADMIN' || req.user.canApproveBooking) return next()
  next(forbidden())
}
