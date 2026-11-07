import type { NextFunction, Request, Response } from 'express'
import type { Role, User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { cookieNames, verifyAccessToken } from '../lib/auth'
import { forbidden, unauthorized } from '../lib/http-error'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'name' | 'email' | 'role' | 'companyName'>
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
      select: { id: true, name: true, email: true, role: true, companyName: true, isActive: true },
    })
    if (!user || !user.isActive) throw unauthorized('Akun tidak aktif')

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
    }
    next()
  } catch (error) {
    next(error instanceof Error && error.name === 'HttpError' ? error : unauthorized())
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
