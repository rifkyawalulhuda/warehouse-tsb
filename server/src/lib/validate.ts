import { z, type ZodType } from 'zod'
import { badRequest } from './http-error'

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')

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
