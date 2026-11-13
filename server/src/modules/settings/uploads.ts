import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { badRequest } from '../../lib/http-error'

export const UPLOAD_PATH = '/api/uploads'

/**
 * Gambar halaman masuk disimpan di disk, bukan di database: satu foto 2 MB di
 * kolom teks akan ikut terbaca setiap kali pengaturan dibuka.
 *
 * Ukuran 2 MB dipilih karena halaman masuk hanya menampilkannya di panel
 * kanan berukuran ~500 px — file lebih besar dari itu tidak menambah ketajaman
 * yang terlihat, hanya memperlambat muat pertama tanpa sesi.
 */
const MAX_BYTES = 2 * 1024 * 1024

/** Tipe yang diterima, beserta ekstensi yang dipakai saat disimpan. */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  {
    mime: 'image/png',
    ext: 'png',
    test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
]

/**
 * Jenis berkas ditentukan dari isi, bukan dari header `Content-Type` yang
 * dikirim peramban: header bisa berbohong, sedangkan tanda tangan biner tidak.
 * Ini mencegah file SVG berisi skrip disamarkan sebagai PNG.
 */
function sniff(buffer: Buffer) {
  return SIGNATURES.find((entry) => entry.test(buffer)) ?? null
}

export function uploadsDir() {
  return join(process.cwd(), 'uploads')
}

/**
 * Folder dibuat sekali, bukan diperiksa di setiap unggahan: `existsSync` +
 * `mkdirSync` menahan seluruh event loop hanya untuk memastikan folder yang
 * sama ada. Bila pembuatan gagal, hasilnya dibuang agar percobaan berikutnya
 * mencoba lagi.
 */
let directoryReady: Promise<void> | null = null

function ensureUploadsDir(): Promise<void> {
  directoryReady ??= mkdir(uploadsDir(), { recursive: true }).then(
    () => undefined,
    (error: unknown) => {
      directoryReady = null
      throw error
    }
  )
  return directoryReady
}

export const uploadsRouter = Router()

/**
 * Satu penangan untuk semua unggahan gambar: yang berbeda hanya awalan nama
 * berkas, supaya gambar panel dan logo tidak pernah tertukar di folder disk.
 */
function handleUpload(prefix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw badRequest('UPLOAD_EMPTY', 'Berkas gambar kosong.')
      }
      if (body.length > MAX_BYTES) {
        throw badRequest('UPLOAD_TOO_LARGE', 'Gambar maksimal 2 MB.')
      }

      const kind = sniff(body)
      if (!kind) {
        throw badRequest('UPLOAD_TYPE', 'Gambar harus PNG atau JPG.')
      }

      const name = `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}.${kind.ext}`
      await ensureUploadsDir()
      await writeFile(join(uploadsDir(), name), body)

      res.json({ data: { url: `${UPLOAD_PATH}/${name}` } })
    } catch (error) {
      next(error)
    }
  }
}

/**
 * `PUT /api/uploads/login-cover` dengan badan biner mentah (bukan multipart).
 * Admin mengunggah satu gambar; nama berkas dibuat acak sehingga tidak ada
 * nama dari klien yang pernah menyentuh jalur disk.
 *
 * Rute ini memakai parser binernya sendiri di app.ts, di depan body JSON,
 * karena berkas gambar bukan JSON.
 */
uploadsRouter.put(
  '/login-cover',
  requireAuth,
  requireExactRole('ADMIN'),
  handleUpload('login-cover')
)

/**
 * `PUT /api/uploads/logo` — logo aplikasi. Batas 2 MB yang sama dipakai karena
 * yang membatasi bukan ukuran berkas, melainkan waktu muat halaman masuk yang
 * dibuka tanpa sesi di jaringan ponsel.
 */
uploadsRouter.put(
  '/logo',
  requireAuth,
  requireExactRole('ADMIN'),
  handleUpload('app-logo')
)
