import { Router, type Response } from 'express'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  cookieNames,
  cookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../../lib/auth'
import { env } from '../../config/env'
import { parse } from '../../lib/validate'
import { unauthorized } from '../../lib/http-error'
import { requireAuth, type RequestUser } from '../../middleware/auth'

export const authRouter = Router()

const loginSchema = z.object({
  email: z.email('Format email tidak valid').transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, 'Password wajib diisi'),
})

type SessionPayload = { sub: string; role: Role; name: string; email: string }

function setSessionCookies(res: Response, payload: SessionPayload) {
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken({ sub: payload.sub, tokenId: 'v1' })
  res.cookie(cookieNames.access, accessToken, cookieOptions(env.jwt.accessTtlMinutes * 60_000))
  res.cookie(
    cookieNames.refresh,
    refreshToken,
    cookieOptions(env.jwt.refreshTtlDays * 24 * 60 * 60_000)
  )
}

function publicUser(user: RequestUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customerId: user.customerId,
    // Nama perusahaan milik akun customer. Layar customer memakainya untuk
    // menyebut "perusahaan Anda" tanpa perlu endpoint master customers, yang
    // memang hanya untuk Admin.
    customerName: user.customerName,
    // Frontend memakainya untuk menyembunyikan tab Persetujuan dari pengguna
    // yang memang tidak berhak. Server tetap menolak sendiri (403).
    canApproveBooking: user.canApproveBooking,
  }
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = parse(loginSchema, req.body, 'Data login')
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { customer: { select: { name: true } } },
    })

    // Pesan sama untuk email tidak ada dan password salah, agar tidak bisa ditebak.
    if (!user || !user.isActive) throw unauthorized('Email atau password salah')
    const ok = await verifyPassword(body.password, user.passwordHash)
    if (!ok) throw unauthorized('Email atau password salah')

    setSessionCookies(res, {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    })

    res.json({
      data: publicUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        customerName: user.customer?.name ?? null,
        canApproveBooking: user.canApproveBooking,
      }),
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[cookieNames.refresh] as string | undefined
    if (!token) throw unauthorized()

    let claims: { sub: string }
    try {
      claims = verifyRefreshToken(token)
    } catch {
      throw unauthorized('Sesi sudah berakhir, silakan masuk lagi')
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      include: { customer: { select: { name: true } } },
    })
    if (!user || !user.isActive) throw unauthorized('Akun tidak aktif')

    setSessionCookies(res, {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    })

    res.json({
      data: publicUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        customerName: user.customer?.name ?? null,
        canApproveBooking: user.canApproveBooking,
      }),
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(cookieNames.access, { path: '/' })
  res.clearCookie(cookieNames.refresh, { path: '/' })
  res.json({ data: { ok: true } })
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user })
})
