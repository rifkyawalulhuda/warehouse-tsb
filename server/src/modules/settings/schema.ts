import { z } from 'zod'

/**
 * Gambar halaman masuk dan logo hanya dari unggahan kita sendiri atau http(s).
 *
 * Kedua nilai dirender di halaman tanpa sesi — logo di tab dan panel masuk,
 * gambar panel sebagai CSS `url()`. Skema seperti `javascript:` atau `data:`
 * yang lolos ke sana berubah menjadi jalan eksekusi di peramban pengunjung,
 * jadi penyaringannya dilakukan di skema, satu tempat, bukan di tiap layar.
 */
export function isSafeImageUrl(value: string): boolean {
  if (value.startsWith('/api/uploads/')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Batas panjang mengikuti kolom database: tolak di sini, bukan saat menyimpan. */
export const updateSchema = z.object({
  warehouseName: z.string().trim().min(2).max(120).optional(),
  appName: z.string().trim().min(1).max(60).optional(),
  appTagline: z.string().trim().max(80).optional(),
  // Null/"" melepas nama pendek, sehingga judul tab kembali memakai appName.
  appShortName: z.string().trim().max(20).nullable().optional(),
  appLogoUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === '' || isSafeImageUrl(value), {
      message: 'URL logo harus diawali /api/uploads/ atau http(s)://',
    })
    .nullable()
    .optional(),
  // Paragraf sambutan halaman masuk. Null/"" berarti memakai teks bawaan.
  loginDescription: z.string().trim().max(240).nullable().optional(),
  loginCoverUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === '' || isSafeImageUrl(value), {
      message: 'URL gambar harus diawali /api/uploads/ atau http(s)://',
    })
    .nullable()
    .optional(),
  // Hex 6 digit; null/"" berarti kembali ke gradien bawaan.
  loginBrandColor: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{6})$/, 'Warna harus berupa hex, misalnya #1D4ED8')
    .nullable()
    .optional(),
  operatingStartMinute: z.number().int().min(0).max(1439).optional(),
  operatingEndMinute: z.number().int().min(1).max(1440).optional(),
  slotUnitMinutes: z.number().int().min(15).max(120).optional(),
  gracePeriodMinutes: z.number().int().min(0).max(240).optional(),
  earlyArrivalLimitMinutes: z.number().int().min(0).max(480).optional(),
  bookingWindowDays: z.number().int().min(1).max(90).optional(),
  approvalMode: z.enum(['AUTO', 'MANUAL']).optional(),
  approvalLeadMinutes: z.number().int().min(5).max(2880).optional(),
  approvalMinDecisionMinutes: z.number().int().min(5).max(1440).optional(),
  approvalUrgentBufferMinutes: z.number().int().min(0).max(14400).optional(),
})

export type SettingsUpdate = z.infer<typeof updateSchema>
