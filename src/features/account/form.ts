/**
 * Aturan isian Pengaturan Akun, dipisah dari komponen supaya bisa diuji tanpa
 * merender apa pun.
 *
 * Semua fungsi mengembalikan KODE masalah, bukan kalimat jadi: kalimatnya
 * dipilih komponen lewat `useT()`, sehingga berkas ini tidak perlu tahu bahasa
 * yang sedang aktif dan tidak ikut berubah saat kamus bertambah.
 */

export const PASSWORD_MIN_LENGTH = 7

/**
 * Cukup ketat untuk menangkap salah ketik yang jelas (tanpa @, tanpa domain,
 * spasi di tengah), tetapi tidak mencoba menegakkan RFC 5322. Validasi
 * sebenarnya tetap di server; ini hanya mempercepat umpan balik.
 */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export type EmailProblem = 'invalid' | 'same' | 'mismatch' | 'passwordMissing'

export function emailProblem(
  values: { email: string; repeat: string; password: string },
  currentEmail: string
): EmailProblem | null {
  const email = values.email.trim()
  if (!looksLikeEmail(email)) return 'invalid'
  // Dibandingkan tanpa peduli huruf besar-kecil: server menyimpan email dalam
  // huruf kecil, jadi "Budi@Gudang.id" bukan perubahan yang berarti.
  if (email.toLowerCase() === currentEmail.trim().toLowerCase()) return 'same'
  if (email !== values.repeat.trim()) return 'mismatch'
  if (!values.password) return 'passwordMissing'
  return null
}

export type PasswordProblem =
  | 'currentMissing'
  | 'short'
  | 'same'
  | 'mismatch'

export function passwordProblem(values: {
  current: string
  next: string
  repeat: string
}): PasswordProblem | null {
  if (!values.current) return 'currentMissing'
  if (values.next.length < PASSWORD_MIN_LENGTH) return 'short'
  if (values.next === values.current) return 'same'
  if (values.next !== values.repeat) return 'mismatch'
  return null
}

export type ProfileProblem = 'name' | 'phone'

export function profileProblem(values: {
  name: string
  phone: string
}): ProfileProblem | null {
  if (values.name.trim().length < 2) return 'name'
  if (values.phone.trim().length > 24) return 'phone'
  return null
}

/** Apakah isian profil berbeda dari yang tersimpan. */
export function profileChanged(
  values: { name: string; phone: string },
  profile: { name: string; phone: string | null }
): boolean {
  return (
    values.name.trim() !== profile.name ||
    values.phone.trim() !== (profile.phone ?? '')
  )
}

/** Apakah ada isian di form email/kata sandi yang sudah diketik. */
export function anyFilled(values: Record<string, string>): boolean {
  return Object.values(values).some((value) => value.length > 0)
}