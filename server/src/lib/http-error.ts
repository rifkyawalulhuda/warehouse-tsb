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

export const forbidden = (message = 'Anda tidak punya akses ke aksi ini') =>
  new HttpError(403, 'FORBIDDEN', message)

export const notFound = (message = 'Data tidak ditemukan') =>
  new HttpError(404, 'NOT_FOUND', message)

export const conflict = (code: string, message: string, details?: unknown) =>
  new HttpError(409, code, message, details)
