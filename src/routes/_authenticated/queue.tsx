import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { QueuePage } from '@/features/queue'
import { RequireAuth } from '@/components/require-auth'

/**
 * Tab disimpan di URL, bukan di state lokal.
 *
 * Penanda persetujuan di menu perlu tujuan yang bisa ditautkan: tanpa ini
 * mengeklik menu bermuatan titik merah hanya membuka tab Antrean, dan Admin
 * masih harus mencari tab Persetujuan sendiri.
 *
 * Nilai asing (tautan lama, salah ketik) jatuh ke tab Antrean, jadi URL yang
 * tidak dikenal tidak pernah membuat halaman galat.
 */
function parseQueueSearch(search: Record<string, unknown>): {
  tab?: 'persetujuan'
} {
  return search.tab === 'persetujuan' ? { tab: 'persetujuan' } : {}
}

/**
 * `Route.useSearch()` dibaca di komponen rute ini, bukan di dalam
 * `features/queue`, mengikuti pola yang sama dengan Master Data: hook itu
 * menuntut rute pemiliknya sedang aktif.
 */
function QueueRouteComponent() {
  const { tab } = Route.useSearch()
  const navigate = useNavigate()

  const setTab = (next: 'queue' | 'approvals') => {
    void navigate({
      to: '/queue',
      search: { tab: next === 'approvals' ? 'persetujuan' : undefined },
      // Berpindah tab tidak perlu menumpuk riwayat; tombol kembali tetap
      // menuju halaman sebelumnya.
      replace: true,
    })
  }

  return (
    <RequireAuth roles={['ADMIN', 'CHECKER']}>
      <QueuePage
        tab={tab === 'persetujuan' ? 'approvals' : 'queue'}
        onTabChange={setTab}
      />
    </RequireAuth>
  )
}

export const Route = createFileRoute('/_authenticated/queue')({
  validateSearch: parseQueueSearch,
  component: QueueRouteComponent,
})
