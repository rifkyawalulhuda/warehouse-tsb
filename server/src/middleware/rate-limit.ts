import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { cookieNames } from '../lib/auth'

const tooMany = (code: string, message: string) => ({
  error: { code, message },
})

/**
 * Kunci pembatas per sesi.
 *
 * Dulu batas ini dikunci pada IP, dan itu keliru di produksi: seluruh lalu
 * lintas masuk lewat satu Cloudflare Tunnel, sehingga semua pengguna tampak
 * berasal dari satu IP dan berbagi satu jatah 600/menit. Satu klien yang
 * menekan server cukup keras akan menolak SEMUA orang lain, termasuk petugas
 * gerbang.
 *
 * Cookie akses dipakai sebagai identitas karena ia satu-satunya yang tersedia
 * sebelum `requireAuth` berjalan, dan httpOnly membuatnya tidak bisa dipalsukan
 * dari JavaScript. Permintaan tanpa sesi (login, tiket publik) tetap memakai IP.
 */
function sessionKey(req: Request): string {
  const raw = req.cookies?.[cookieNames.access] ?? req.cookies?.[cookieNames.refresh]
  if (typeof raw === 'string' && raw.length > 0) {
    // Token tidak disimpan di memori pembatas; hash pendek cukup untuk membedakan
    // sesi tanpa menaruh kredensial di struktur yang bisa tercetak di log.
    const digest = createHash('sha256').update(raw).digest('base64url').slice(0, 22)
    return `sess:${digest}`
  }
  return `ip:${ipKeyGenerator(req.ip ?? '')}`
}

/**
 * Batas pemakaian per sesi: satu klien yang berlebihan melambat sendiri.
 * Angkanya longgar — ini penjaga banjir permintaan, bukan pembatas pemakaian.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: sessionKey,
  // Kode berbeda dari login: penjaga banjir permintaan bukan "percobaan masuk",
  // dan klien menerjemahkan tiap kode menjadi kalimat yang berbeda.
  message: tooMany(
    'TOO_MANY_REQUESTS',
    'Terlalu banyak permintaan. Coba lagi sebentar lagi.'
  ),
})

/**
 * Plafon per IP untuk seluruh proses, sengaja jauh lebih tinggi.
 *
 * Pembatas per sesi di atas bisa dilewati dengan mengirim cookie sembarang,
 * jadi harus ada penjaga yang tidak bergantung pada apa pun dari klien. Yang ini
 * menahan banjir nyata (ribuan permintaan per menit dari satu sumber) tanpa
 * menghukum pengguna normal: 600/menit per sesi tetap yang berlaku sehari-hari.
 */
export const floodLimiter = rateLimit({
  windowMs: 60_000,
  limit: 3000,
  // Header batas dikirim oleh `apiLimiter`; dua set header akan saling menimpa
  // dan membuat angka yang terbaca klien menyesatkan.
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip ?? '')}`,
  message: tooMany(
    'TOO_MANY_REQUESTS',
    'Terlalu banyak permintaan. Coba lagi sebentar lagi.'
  ),
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
  message: tooMany(
    'TOO_MANY_ATTEMPTS',
    'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.'
  ),
})

/**
 * Pembatas untuk aksi akun yang meminta ulang kata sandi (ganti email, ganti
 * kata sandi).
 *
 * Kuncinya id pengguna, bukan email: orangnya sudah masuk, jadi yang perlu
 * melambat adalah akun itu. Tanpa pembatas ini, cookie sesi yang dicuri bisa
 * dipakai menebak kata sandi tanpa batas — dan tebakan yang berhasil justru
 * mengunci pemilik aslinya di luar.
 *
 * Pesan galatnya sengaja menyebut "kata sandi", bukan "masuk": pengguna sedang
 * di dalam aplikasi, dan kalimat "percobaan masuk" akan membingungkan.
 */
export const accountLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) =>
    req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`,
  message: tooMany(
    'TOO_MANY_PASSWORD_ATTEMPTS',
    'Terlalu banyak percobaan kata sandi. Coba lagi dalam 15 menit.'
  ),
})

/**
 * Pembatas untuk perubahan data kendaraan dari halaman tiket publik.
 *
 * Rute ini satu-satunya penulisan tanpa login, dan tokennya tercetak di tiket
 * yang bisa difoto siapa saja di lokasi. Kuncinya token, bukan IP (seluruh lalu
 * lintas produksi berbagi satu IP lewat Cloudflare Tunnel): satu tiket tidak
 * boleh bisa ditulis berulang-ulang, tanpa menghukum supir lain.
 */
export const publicTicketWriteLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const token = typeof req.params?.qrToken === 'string' ? req.params.qrToken : ''
    return token ? `ticket:${token}` : `ip:${ipKeyGenerator(req.ip ?? '')}`
  },
  message: tooMany(
    'TOO_MANY_REQUESTS',
    'Terlalu banyak perubahan data kendaraan. Coba lagi nanti.'
  ),
})
