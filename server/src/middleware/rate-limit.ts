import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'

const tooMany = (message: string) => ({
  error: { code: 'TOO_MANY_ATTEMPTS', message },
})

/**
 * Batas kasar untuk seluruh API: satu proses Node melayani semua pengguna, jadi
 * lonjakan permintaan otomatis juga menahan dashboard orang lain. Angkanya
 * sengaja longgar — ini penjaga banjir permintaan, bukan pembatas pemakaian.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany('Terlalu banyak permintaan. Coba lagi sebentar lagi.'),
})

/**
 * Kunci pembatas login adalah alamat email yang dicoba, bukan IP.
 *
 * Alasannya dua: penebakan kata sandi menyasar satu akun (jadi akun itulah yang
 * harus melambat), dan di produksi seluruh lalu lintas masuk lewat satu tunnel
 * sehingga semua pengguna bisa tampak berasal dari IP yang sama. Percobaan yang
 * berhasil tidak dihitung, jadi pengguna sah tidak pernah terkena batas ini.
 */
function loginKey(req: Request): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  return email ? `email:${email}` : `ip:${ipKeyGenerator(req.ip ?? '')}`
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: loginKey,
  message: tooMany('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'),
})
