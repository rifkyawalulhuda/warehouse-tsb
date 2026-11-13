import { useEffect } from 'react'

/**
 * Mengganti ikon tab peramban dengan logo unggahan Admin.
 *
 * `index.html` memuat empat ikon bawaan (SVG dan PNG, masing-masing untuk tema
 * terang dan gelap). Selama logo belum diunggah, keempatnya dibiarkan apa
 * adanya. Begitu logo ada, ikon bawaan dilepas sementara dan satu ikon baru
 * dipasang; saat logo dihapus, ikon bawaan dikembalikan.
 *
 * Nama berkas logo selalu unik per unggahan, jadi peramban tidak perlu diminta
 * membersihkan cache ikon — alamatnya memang berbeda.
 */
export function useFavicon(url: string | null) {
  useEffect(() => {
    if (!url) return

    const statics = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"]:not([data-brand-logo])'
      )
    )
    for (const link of statics) link.remove()

    const icon = document.createElement('link')
    icon.rel = 'icon'
    icon.dataset.brandLogo = 'true'
    icon.href = url
    document.head.appendChild(icon)

    return () => {
      icon.remove()
      // Urutan ikon bawaan tidak penting bagi peramban; yang penting semuanya
      // kembali sebelum logo berikutnya dipasang.
      for (const link of statics) document.head.appendChild(link)
    }
  }, [url])
}
