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

/**
 * Mencabut semua sesi lain, kecuali sesi yang sedang dipakai.
 *
 * Dipakai saat pengguna mengganti kata sandinya sendiri. `revokeUserSessions`
 * tidak cocok di sini: ia mencabut sesi yang sedang aktif juga, sehingga orang
 * yang baru memperkuat akunnya justru terlempar keluar di perangkat yang ia
 * pegang. `keepSessionId` adalah `sid` dari cookie refresh — id baris
 * `refresh_sessions`, bukan id pengguna.
 *
 * Bila `keepSessionId` null (cookie refresh tidak ada atau rusak), semua sesi
 * dicabut: tidak ada sesi yang bisa disebut "yang sedang dipakai".
 */
export async function revokeOtherSessions(
  tx: Tx,
  userId: string,
  keepSessionId: string | null
): Promise<number> {
  const result = await tx.refreshSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  })
  return result.count
}
