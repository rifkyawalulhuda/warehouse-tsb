import { useLocation, useRouter } from '@tanstack/react-router'

/**
 * Apakah tab ini punya halaman sebelumnya untuk dituju.
 *
 * `canGoBack()` membaca riwayat di luar state React, jadi lokasi dilanggan dulu
 * supaya nilainya dibaca ulang setiap kali pengguna berpindah halaman. Tanpa
 * itu nilainya bisa tertinggal pada keadaan saat halaman pertama dibuka.
 *
 * `false` untuk tab yang dibuka langsung dari tautan (WhatsApp, bookmark): di
 * sana `back()` justru melempar pengguna keluar dari aplikasi.
 */
export function useCanGoBack() {
  useLocation({ select: (location) => location.href })
  return useRouter().history.canGoBack()
}
