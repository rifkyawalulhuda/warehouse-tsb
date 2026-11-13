import type { Tx } from '../../lib/prisma'

/**
 * Mencabut semua sesi milik satu pengguna.
 *
 * Dipanggil saat kata sandi diganti, akun dinonaktifkan, atau perannya turun:
 * semuanya perubahan yang membuat token lama tidak lagi mewakili orang yang
 * sama. Token akses tetap hidup sampai 15 menit, tetapi tanpa sesi refresh ia
 * tidak bisa diperpanjang, dan `requireAuth` sendiri sudah membaca ulang peran
 * serta status aktif dari database.
 */
export async function revokeUserSessions(tx: Tx, userId: string): Promise<void> {
  await tx.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
