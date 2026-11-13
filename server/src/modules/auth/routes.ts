import { Router, type Response } from 'express'
import { z } from 'zod'
import type { Role } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import {
  cookieNames,
  cookieOptions,
  generateSessionId,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
  type RefreshClaims,
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

const REFRESH_TTL_MS = env.jwt.refreshTtlDays * 24 * 60 * 60_000

function writeSessionCookies(res: Response, payload: SessionPayload, refreshToken: string) {
  const accessToken = signAccessToken(payload)
  res.cookie(cookieNames.access, accessToken, cookieOptions(env.jwt.accessTtlMinutes * 60_000))
  res.cookie(cookieNames.refresh, refreshToken, cookieOptions(REFRESH_TTL_MS))
}

/**
 * Memulai sesi baru.
 *
 * Token refresh menyimpan id baris (`sid`), bukan hanya tanda tangan: itulah
 * yang membuat `logout`, ganti kata sandi, dan penonaktifan akun bisa benar
 * benar mengakhiri sesi. Yang disimpan di database hanya hash token, jadi isi
 * tabel tidak bisa dipakai untuk masuk bila suatu saat bocor.
 */
async function startSession(res: Response, payload: SessionPayload): Promise<void> {
  const sid = generateSessionId()
  const refreshToken = signRefreshToken({ sub: payload.sub, sid })
  const now = new Date()

  await prisma.$transaction([
    // Baris kedaluwarsa milik pengguna ini dibuang saat login, supaya tabel
    // tidak tumbuh tanpa batas tanpa perlu job terjadwal.
    prisma.refreshSession.deleteMany({
      where: { userId: payload.sub, expiresAt: { lt: now } },
    }),
    prisma.refreshSession.create({
      data: {
        id: sid,
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      },
    }),
  ])

  writeSessionCookies(res, payload, refreshToken)
}

/** Sesi yang masih boleh dipakai, atau `null` bila sudah tidak berlaku. */
async function activeSession(token: string) {
  let claims: RefreshClaims
  try {
    claims = verifyRefreshToken(token)
  } catch {
    return null
  }
  if (!claims.sub || !claims.sid) return null

  const session = await prisma.refreshSession.findUnique({ where: { id: claims.sid } })
  if (!session || session.userId !== claims.sub) return null
  if (session.revokedAt) return null
  if (session.expiresAt <= new Date()) return null
  // Hash ikut dibandingkan, sehingga token yang ditandatangani dengan rahasia
  // yang sama tetapi bukan token sesi ini tetap ditolak.
  if (session.tokenHash !== hashToken(token)) return null

  return { claims, session }
}

/**
 * Memperpanjang sesi yang sama, bukan membuat sesi baru.
 *
 * Dengan satu baris per sesi, dua tab yang menyegarkan bersamaan tidak saling
 * mematikan. Cookie yang menang tetap menunjuk sesi yang sama.
 */
async function extendSession(
  res: Response,
  payload: SessionPayload,
  claims: RefreshClaims
): Promise<void> {
  const refreshToken = signRefreshToken({ sub: payload.sub, sid: claims.sid })

  await prisma.refreshSession.update({
    where: { id: claims.sid },
    data: {
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  })

  writeSessionCookies(res, payload, refreshToken)
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

    await startSession(res, {
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

    const active = await activeSession(token)
    if (!active) throw unauthorized('Sesi sudah berakhir, silakan masuk lagi')

    const user = await prisma.user.findUnique({
      where: { id: active.claims.sub },
      include: { customer: { select: { name: true } } },
    })
    if (!user || !user.isActive) throw unauthorized('Akun tidak aktif')

    const payload = {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    }

    await extendSession(res, payload, active.claims)

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

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[cookieNames.refresh] as string | undefined

    if (token) {
      // Token rusak atau sudah kedaluwarsa tetap harus menghapus cookie.
      try {
        const claims = verifyRefreshToken(token)
        if (claims.sid) {
          await prisma.refreshSession.updateMany({
            where: { id: claims.sid, userId: claims.sub, revokedAt: null },
            data: { revokedAt: new Date() },
          })
        }
      } catch {
        // Tidak ada yang bisa dicabut.
      }
    }

    res.clearCookie(cookieNames.access, { path: '/' })
    res.clearCookie(cookieNames.refresh, { path: '/' })
    res.json({ data: { ok: true } })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user })
})
