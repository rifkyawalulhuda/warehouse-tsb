import { useEffect } from 'react'

/**
 * Menulis `document.title`. Tidak ada renderer yang menyediakan judul per rute,
 * jadi satu hook kecil ini cukup — dipakai halaman masuk dan tata letak utama.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
