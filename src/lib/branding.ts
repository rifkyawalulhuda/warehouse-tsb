import { useQuery } from '@tanstack/react-query'
import { fetchBranding, type Branding } from '@/lib/api/endpoints'
import { getLocale, translate, useT } from '@/lib/i18n'
import {
  DEFAULT_TICKET_DESIGN,
  isTicketDesign,
} from '@/features/ticket/ticket-design'

/**
 * Paragraf sambutan bawaan halaman masuk. Dipakai sebagai nilai cadangan dan
 * sebagai placeholder di Pengaturan, supaya Admin tahu persis teks apa yang
 * sedang menggantikan isian kosong.
 */
export function defaultLoginDescription(): string {
  return translate(getLocale(), 'auth.defaultLoginDescription')
}

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
  appLogoUrl: null,
  loginDescription: null,
  loginCoverUrl: null,
  loginBrandColor: null,
  // Footer kosong: komponen footer memakai teks bawaan yang mengikuti bahasa
  // aktif, jadi cadangan di sini tidak perlu (dan tidak boleh) memilih bahasa.
  footerCompany: null,
  footerLocation: null,
  footerShowLocation: true,
  // Desain tiket bawaan harus sama dengan nilai bawaan kolom di database;
  // kalau berbeda, tiket tampil beda sesaat sebelum pengaturan termuat.
  ticketDesign: DEFAULT_TICKET_DESIGN,
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
  const t = useT()
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
    // Kosong berarti Admin belum mengunggah logo; lencana huruf lalu dipakai.
    appLogoUrl: data.appLogoUrl?.trim() || null,
    // Paragraf sambutan selalu punya isi: kosong berarti teks bawaan yang
    // mengikuti bahasa aktif, dan layar masuk tidak perlu tahu bedanya.
    loginDescription:
      data.loginDescription?.trim() || t('auth.defaultLoginDescription'),
    // Kosong berarti Admin belum mengunggah apa pun; halaman masuk lalu memakai
    // gradien bawaan, bukan gambar kosong yang tampak rusak.
    loginCoverUrl: data.loginCoverUrl?.trim() || null,
    loginBrandColor: data.loginBrandColor?.trim() || null,
    // Footer dibiarkan null bila kosong: teks bawaannya berbeda per bahasa,
    // jadi yang memilih bahasa adalah komponen footer, bukan hook ini.
    footerCompany: data.footerCompany?.trim() || null,
    footerLocation: data.footerLocation?.trim() || null,
    // Server versi lama tidak mengirim kolom ini; anggap baris lokasi tampil,
    // sama dengan nilai bawaan kolom di database.
    footerShowLocation: data.footerShowLocation ?? true,
    // Server versi lama belum mengirim desain tiket; nilai tak dikenal jatuh
    // ke Klasik supaya tiket tidak pernah gagal dirender.
    ticketDesign: isTicketDesign(data.ticketDesign)
      ? data.ticketDesign
      : DEFAULT_TICKET_DESIGN,
  }
}
