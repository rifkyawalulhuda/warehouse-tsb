export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new HttpError(400, code, message, details)

export const unauthorized = (message = 'Sesi tidak valid atau sudah berakhir') =>
  new HttpError(401, 'UNAUTHORIZED', message)

/**
 * Login gagal — email tidak dikenal, akun nonaktif, atau password salah.
 *
 * Kodenya sengaja BUKAN `UNAUTHORIZED`: kode itu dipakai untuk sesi yang
 * kedaluwarsa, dan klien menerjemahkannya menjadi "Sesi tidak valid atau sudah
 * berakhir". Dulu login yang salah memakai kode itu juga, sehingga orang yang
 * salah mengetik password diberi tahu bahwa sesinya berakhir — padahal ia belum
 * pernah masuk. Pesannya sendiri tetap satu untuk ketiga sebab, supaya email
 * mana yang terdaftar tidak bisa ditebak.
 */
export const invalidCredentials = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau password salah')

export const forbidden = (message = 'Anda tidak punya akses ke aksi ini') =>
  new HttpError(403, 'FORBIDDEN', message)

export const notFound = (message = 'Data tidak ditemukan') =>
  new HttpError(404, 'NOT_FOUND', message)

export const conflict = (code: string, message: string, details?: unknown) =>
  new HttpError(409, code, message, details)
