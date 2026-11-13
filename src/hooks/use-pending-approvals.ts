import { useQuery } from '@tanstack/react-query'
import { fetchApprovalCount } from '@/lib/api/endpoints'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Jumlah booking yang menunggu persetujuan, untuk penanda di menu.
 *
 * Hanya berjalan untuk akun yang benar-benar bisa membuka layar persetujuan.
 * Checker tanpa flag tidak akan pernah bisa menyetujui, jadi menanyakan angka
 * ke server hanya menghasilkan 403 berulang di konsol.
 *
 * Rute `/queue` dijaga untuk ADMIN dan CHECKER. Peran lain yang diberi flag
 * `canApproveBooking` memang boleh memutuskan lewat API, tetapi tidak punya
 * menu untuk ditandai — menyalakan penanda di sana berarti menunjuk halaman
 * yang akan menolaknya.
 *
 * Socket `booking.updated` menyegarkan angka ini seketika (lihat
 * `useRealtimeSync`). `refetchInterval` hanya jaring pengaman saat socket
 * terputus di jaringan gudang.
 */
export function usePendingApprovals() {
  const user = useAuthStore((state) => state.user)
  const canApprove = user?.role === 'ADMIN' || user?.canApproveBooking === true
  const canReachQueue = user?.role === 'ADMIN' || user?.role === 'CHECKER'

  const query = useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: fetchApprovalCount,
    enabled: Boolean(canApprove && canReachQueue),
    refetchInterval: 60_000,
    staleTime: 15_000,
  })

  return query.data?.pending ?? 0
}
