/**
 * Logo yang boleh muncul di kartu tiket — di layar maupun di PNG unduhan.
 *
 * Hanya dua sumber yang diterima: `data:` URL dan apa pun yang berada di origin
 * aplikasi ini (logo unggahan selalu `/api/uploads/...`).
 *
 * Alasannya bukan keamanan, tapi kesetaraan. Kanvas tidak bisa membaca piksel
 * dari domain lain yang tidak mengirim header CORS: gambarnya gagal dimuat di
 * kanvas padahal tampil normal di `<img>` layar. Tanpa aturan bersama ini,
 * tiket yang dilihat supir punya logo sementara tiket yang ia unduh tidak —
 * persis jenis selisih layar↔PNG yang juga dijaga oleh tes tata letak.
 *
 * Menolak di satu tempat membuat keduanya sepakat: tanpa logo, hanya nama
 * aplikasi.
 */
export function safeLogoUrl(raw: string | null | undefined): string | null {
  const src = raw?.trim()
  if (!src) return null
  if (src.startsWith('data:image/')) return src
  try {
    const url = new URL(src, window.location.href)
    return url.origin === window.location.origin ? url.href : null
  } catch {
    return null
  }
}