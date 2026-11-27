import { z, type ZodType } from 'zod'
import { badRequest } from './http-error'
import { isDateISO } from './time'

/** Validasi body/query dengan pesan error yang bisa langsung ditampilkan di UI. */
export function parse<T>(schema: ZodType<T>, value: unknown, label = 'Data'): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
  throw badRequest('VALIDATION_ERROR', `${label} tidak valid`, details)
}

export const dateISOSchema = z
  .string()
  .refine(isDateISO, 'Format tanggal harus YYYY-MM-DD dan tanggalnya harus ada')

export const activitySchema = z.enum(['LOADING', 'UNLOADING'])

export const plateSchema = z
  .string()
  .trim()
  .min(3, 'Plat nomor terlalu pendek')
  .max(20, 'Plat nomor terlalu panjang')
  .transform((v) => v.toUpperCase().replace(/\s+/g, ' '))

export const phoneSchema = z
  .string()
  .trim()
  .max(24)
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => v === '' || /^\+?\d{8,15}$/.test(v), 'Nomor WhatsApp tidak valid')
