import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http-error'
import { SlotRangeError } from '../lib/quota'
import { env } from '../config/env'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ada' } })
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    })
    return
  }

  if (error instanceof SlotRangeError) {
    res.status(400).json({
      error: { code: error.code, message: error.message },
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data tidak valid',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: { code: 'DUPLICATE', message: 'Data sudah ada' },
      })
      return
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Data tidak ditemukan' },
      })
      return
    }
  }

  /**
   * Galat dari middleware badan permintaan (`express.json`, `express.raw`)
   * sudah membawa status yang benar: JSON rusak = 400, badan terlalu besar =
   * 413. Tanpa cabang ini keduanya jatuh ke 500, sehingga log penuh "unhandled
   * error" hanya karena klien mengirim badan yang salah.
   */
  const bodyError = error as { status?: unknown; type?: unknown }
  if (typeof bodyError?.status === 'number' && bodyError.status >= 400 && bodyError.status < 500) {
    const tooLarge = bodyError.type === 'entity.too.large'
    res.status(bodyError.status).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST',
        message: tooLarge
          ? 'Badan permintaan terlalu besar'
          : 'Badan permintaan tidak bisa dibaca',
      },
    })
    return
  }

  // eslint-disable-next-line no-console
  console.error('[api] unhandled error', error)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server',
      ...(env.isProduction ? {} : { hint: (error as Error)?.message }),
    },
  })
}
