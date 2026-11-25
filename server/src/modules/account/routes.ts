import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth } from '../../middleware/auth'
import { accountLimiter } from '../../middleware/rate-limit'
import {
  cookieNames,
  hashPassword,
  verifyPassword,
  verifyRefreshToken,
} from '../../lib/auth'
import { badRequest, conflict } from '../../lib/http-error'
import { writeAudit } from '../../lib/audit'
import { revokeOtherSessions } from '../auth/sessions'

/**
 * Pengaturan Akun — satu-satunya tempat pengguna mengubah datanya sendiri.
 *
 * Berbeda dari `/api/users` yang khusus Admin: di sini setiap peran boleh
 * masuk, tetapi hanya untuk akunnya sendiri. Tidak ada parameter id pengguna
 * di jalur mana pun; id selalu diambil dari sesi, sehingga tidak ada celah
 * untuk mengedit akun orang lain dengan menebak id.
 *
 * Email dan kata sandi meminta ulang kata sandi saat ini. Bukan sekadar
 * formalitas: cookie sesi yang dicuri bisa dipakai mengubah identitas masuk
 * bila tidak ada verifikasi ulang, dan akibatnya pemilik akun kehilangan
 * aksesnya sendiri.
 */
export const accountRouter = Router()

accountRouter.use(requireAuth)

/** Data akun yang dikirim ke layar Pengaturan Akun. */
const profileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  canApproveBooking: true,
  createdAt: true,
  customer: { select: { name: true } },
} as const

function activeSessionCount(userId: string) {
  return prisma.refreshSession.count({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
  })
}

async function profilePayload(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: profileSelect,
  })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    customerName: user.customer?.name ?? null,
    canApproveBooking: user.canApproveBooking,
    createdAt: user.createdAt.toISOString(),
    activeSessions: await activeSessionCount(userId),
  }
}

/**
 * Id sesi yang sedang dipakai, dibaca dari cookie refresh.
 *
 * Nilainya `sid` di dalam token, bukan id pengguna: satu pengguna bisa punya
 * beberapa baris `refresh_sessions`, dan yang boleh dipertahankan hanya baris
 * yang benar-benar sedang dipakai perangkat ini. Cookie yang tidak terbaca
 * dianggap "tidak ada sesi saat ini".
 */
function currentSessionId(req: Request): string | null {
  const token = req.cookies?.[cookieNames.refresh] as string | undefined
  if (!token) return null
  try {
    return verifyRefreshToken(token).sid
  } catch {
    return null
  }
}

accountRouter.get('/', async (req, res, next) => {
  try {
    res.json({ data: await profilePayload(req.user!.id) })
  } catch (error) {
    next(error)
  }
})

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120, 'Nama maksimal 120 karakter').optional(),
  // String kosong berarti "hapus nomor", bukan "jangan diubah" — form web
  // mengirim isi kolom apa adanya, dan kolom yang dikosongkan harus benar-benar
  // kosong di database, bukan tersimpan sebagai string kosong.
  phone: z.string().trim().max(24, 'Nomor HP maksimal 24 karakter').optional(),
})

accountRouter.patch('/profile', async (req, res, next) => {
  try {
    const body = parse(profileSchema, req.body, 'Profil')
    const userId = req.user!.id

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      },
    })

    // Nama dan nomor HP sengaja tidak masuk audit log — sama seperti jalur
    // Admin di /api/users: keduanya sering dikoreksi dan bukan perubahan hak
    // akses, jadi mencatatnya hanya membanjiri log.
    res.json({ data: await profilePayload(userId) })
  } catch (error) {
    next(error)
  }
})

/**
 * Kata sandi saat ini salah dijawab 400, BUKAN 401.
 *
 * Klien memperlakukan 401 sebagai "sesi berakhir": ia mencoba refresh lalu
 * melempar pengguna ke halaman masuk. Memakai 401 di sini akan membuat orang
 * yang salah mengetik kata sandi terlempar keluar dari akunnya sendiri.
 */
const wrongPassword = () =>
  badRequest('INVALID_PASSWORD', 'Kata sandi saat ini tidak cocok')

const emailSchema = z.object({
  email: z.email('Format email tidak valid').transform((v) => v.trim().toLowerCase()),
  currentPassword: z.string().min(1, 'Masukkan kata sandi saat ini'),
})

accountRouter.patch('/email', accountLimiter, async (req, res, next) => {
  try {
    const body = parse(emailSchema, req.body, 'Email')
    const userId = req.user!.id

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, passwordHash: true, role: true },
    })

    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw wrongPassword()
    }
    if (body.email === user.email) {
      throw badRequest('EMAIL_UNCHANGED', 'Email baru sama dengan email sekarang')
    }

    const taken = await prisma.user.findFirst({
      where: { email: body.email, id: { not: userId } },
      select: { id: true },
    })
    if (taken) throw conflict('EMAIL_TAKEN', 'Email ini sudah dipakai akun lain')

    await prisma.user.update({ where: { id: userId }, data: { email: body.email } })

    // Sesi lain dicabut: identitas masuk berubah, jadi perangkat yang mungkin
    // sudah tidak dipegang pemiliknya tidak boleh tetap punya akses.
    await revokeOtherSessions(prisma, userId, currentSessionId(req))

    await writeAudit({
      userId,
      userRole: user.role,
      action: 'ACCOUNT_EMAIL_CHANGED',
      meta: { from: user.email, to: body.email },
    })

    res.json({ data: await profilePayload(userId) })
  } catch (error) {
    next(error)
  }
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Masukkan kata sandi saat ini'),
  newPassword: z
    .string()
    .min(7, 'Kata sandi baru minimal 7 karakter')
    // bcrypt hanya memakai 72 bita pertama; menolak yang lebih panjang lebih
    // jujur daripada menerima lalu memotongnya diam-diam.
    .max(72, 'Kata sandi maksimal 72 karakter'),
})

accountRouter.patch('/password', accountLimiter, async (req, res, next) => {
  try {
    const body = parse(passwordSchema, req.body, 'Kata sandi')
    const userId = req.user!.id

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    })

    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw wrongPassword()
    }
    // Tanpa pemeriksaan ini, "ganti kata sandi" bisa berhasil tanpa mengubah
    // apa pun — dan pengguna mengira akunnya sudah diperkuat.
    if (body.newPassword === body.currentPassword) {
      throw badRequest('PASSWORD_UNCHANGED', 'Kata sandi baru sama dengan yang sekarang')
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(body.newPassword) },
    })

    const revoked = await revokeOtherSessions(prisma, userId, currentSessionId(req))

    await writeAudit({
      userId,
      userRole: user.role,
      action: 'ACCOUNT_PASSWORD_CHANGED',
      meta: { revokedSessions: revoked },
    })

    res.json({
      data: { revoked, activeSessions: await activeSessionCount(userId) },
    })
  } catch (error) {
    next(error)
  }
})

accountRouter.post('/sessions/revoke-others', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const revoked = await revokeOtherSessions(prisma, userId, currentSessionId(req))

    await writeAudit({
      userId,
      userRole: req.user!.role,
      action: 'ACCOUNT_SESSIONS_REVOKED',
      meta: { revoked },
    })

    res.json({
      data: { revoked, activeSessions: await activeSessionCount(userId) },
    })
  } catch (error) {
    next(error)
  }
})