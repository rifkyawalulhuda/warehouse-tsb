/**
 * Jumlah blok kuota untuk sebuah durasi proses.
 *
 * Satu tempat untuk angka ini, karena tiga hal harus selalu sepakat: master
 * jenis truk (yang menampilkan blok), ketersediaan slot (yang menghitung sisa),
 * dan pembuatan booking (yang mengunci). Sebelumnya rumus ini hidup di dalam
 * `master/routes.ts` saja.
 *
 * Minimal 1 blok: durasi 0 menit mustahil, tetapi pembulatan ke atas pada angka
 * kecil pun tidak boleh menghasilkan 0 — booking tanpa blok tidak akan pernah
 * mengurangi kuota sehingga slot yang sama bisa dijual berkali-kali.
 */
export function blocksForDuration(
  durationMinutes: number,
  slotUnitMinutes: number
): number {
  return Math.max(1, Math.ceil(durationMinutes / slotUnitMinutes))
}