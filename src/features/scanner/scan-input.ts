/**
 * Kode booking yang tercetak di tiket: `TSB-YYYYMMDD-NNN`.
 *
 * Petugas gate sering mengetik kode ini karena hurufnya besar di tiket, jadi
 * layar gate menerimanya selain token QR.
 */
const BOOKING_CODE = /^TSB-\d{8}-\d{3}$/i

/**
 * Token QR dari server: 24 byte acak dalam base64url (32 karakter, tanpa
 * padding). Rentang 16–64 memberi ruang bila panjang token berubah.
 */
const QR_TOKEN = /^[A-Za-z0-9_-]{16,64}$/

export type ScanInput =
  { kind: 'token'; value: string } | { kind: 'booking-code'; value: string }

/**
 * Baca masukan manual di layar gate.
 *
 * Kode booking dinormalkan ke huruf besar supaya `tsb-20261111-003` tetap
 * diterima. Token QR tidak diubah karena base64url membedakan huruf besar dan
 * kecil. Bentuk yang tidak dikenali mengembalikan `null`, supaya tombol Cek
 * tidak mengirim teks acak ke server.
 */
export function parseScanInput(raw: string): ScanInput | null {
  const value = raw.trim()
  if (!value) return null

  if (BOOKING_CODE.test(value)) {
    return { kind: 'booking-code', value: value.toUpperCase() }
  }

  if (QR_TOKEN.test(value)) {
    return { kind: 'token', value }
  }

  return null
}
