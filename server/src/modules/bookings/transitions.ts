import type { BookingStatus, Prisma } from '@prisma/client'
import type { Tx } from '../../lib/prisma'
import { conflict } from '../../lib/http-error'

/**
 * Satu-satunya cara status booking boleh berpindah.
 *
 * Pemeriksaan `status` di luar transaksi hanya untuk pesan galat yang enak
 * dibaca; ia tidak mengikat apa pun, karena dua petugas (atau satu petugas yang
 * menekan tombol dua kali) bisa sama-sama membacanya sebelum salah satu menulis.
 * Karena itu perpindahan status di sini memakai `updateMany` dengan syarat
 * status: penjaga dan penulisan menjadi satu pernyataan, dan Postgres
 * menyerialkan dua penulis pada baris yang sama.
 *
 * `count === 0` berarti booking sudah berpindah lebih dulu. Transaksi pemanggil
 * dibatalkan, sehingga perubahan lain di dalamnya (dock, kuota, audit) ikut
 * dibatalkan — tidak ada efek samping dari pihak yang kalah.
 */
export async function transitionBooking(
  tx: Tx,
  id: string,
  from: readonly BookingStatus[],
  data: Prisma.BookingUncheckedUpdateManyInput
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id, status: { in: [...from] } },
    data,
  })

  if (result.count === 0) {
    throw conflict(
      'INVALID_TRANSITION',
      'Status booking sudah berubah. Muat ulang lalu coba lagi.'
    )
  }
}
