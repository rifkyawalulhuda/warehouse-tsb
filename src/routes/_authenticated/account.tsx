import { createFileRoute } from '@tanstack/react-router'
import { AccountPage } from '@/features/account'

/**
 * Pengaturan Akun milik setiap peran yang sudah masuk.
 *
 * Tidak ada `RequireAuth roles={...}` di sini: halaman ini hanya menyentuh akun
 * orang yang sedang masuk, jadi Admin, Gate, Checker, dan Customer semuanya
 * berhak. Pembatasan id ada di server — id selalu diambil dari sesi.
 */
export const Route = createFileRoute('/_authenticated/account')({
  component: AccountPage,
})