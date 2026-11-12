import { useQuery } from '@tanstack/react-query'
import { fetchBranding, type Branding } from '@/lib/api/endpoints'

/**
 * Judul aplikasi yang diatur Admin. Muncul di sidebar, halaman masuk, dan judul
 * tab peramban; semuanya memakai satu sumber supaya tidak pernah ada layar yang
 * masih menulis nama lama setelah diganti.
 *
 * Nilai cadangan dipakai selama permintaan pertama belum selesai — dan seterusnya
 * bila server tidak terjangkau. Judul tidak boleh kosong hanya karena jaringan
 * lambat. Data dianggap tidak pernah basi karena nama merek berubah sangat jarang
 * dan setiap penyimpanan di Pengaturan meng-invalidate kuncinya.
 */
export const DEFAULT_BRANDING: Branding = {
  appName: 'Warehouse TSB',
  appTagline: 'Time Slot Booking',
  appShortName: null,
}

/**
 * Huruf pertama untuk lencana logo. Memakai kata pertama yang punya huruf, jadi
 * "Gudang Utama" memberi "G", bukan spasi.
 */
export function brandInitial(name: string): string {
  const letter = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .find((word) => word.length > 0)
  return (letter?.[0] ?? 'T').toUpperCase()
}

/**
 * Nama untuk judul tab peramban. Nama pendek menang bila diisi — tab selebar
 * ~15 karakter di peramban ponsel tidak muat menampilkan judul panjang.
 */
export function tabTitle(appName: string, appShortName: string | null): string {
  const short = appShortName?.trim()
  return short ? short : appName
}

export function useBranding(): Branding {
  const query = useQuery({
    queryKey: ['branding'],
    queryFn: fetchBranding,
    staleTime: Infinity,
    retry: 1,
  })

  const data = query.data
  if (!data) return DEFAULT_BRANDING
  return {
    appName: data.appName || DEFAULT_BRANDING.appName,
    appTagline: data.appTagline,
    appShortName: data.appShortName,
  }
}
