import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/components/require-auth'
import { MasterData } from '@/features/master'
import type { MasterTab } from '@/features/master/tabs'

export type MasterSearch = { tab?: MasterTab }

/**
 * `?tab=` menentukan tab yang dibuka. Nilai asing (tautan lama, salah ketik)
 * dibiarkan lewat dan ditolak di layar dengan jatuh ke tab Dock, jadi URL yang
 * tidak dikenal tidak pernah membuat halaman galat.
 */
function parseMasterSearch(search: Record<string, unknown>): MasterSearch {
  const tab = typeof search.tab === 'string' ? search.tab : undefined
  return tab ? { tab: tab as MasterTab } : {}
}

/**
 * Tab awal dibaca di komponen rute ini lalu dioper sebagai prop.
 *
 * `Route.useSearch()` sengaja tidak dipakai dari dalam `features/master` atau
 * layar lain: hook itu menuntut rute pemiliknya sedang aktif, dan memanggilnya
 * dari halaman Pengguna membuat router melempar "Could not find an active
 * match".
 */
function MasterRouteComponent() {
  const { tab } = Route.useSearch()
  return (
    <RequireAuth roles={['ADMIN']}>
      <MasterData initialTab={tab} />
    </RequireAuth>
  )
}

export const Route = createFileRoute('/_authenticated/master')({
  validateSearch: parseMasterSearch,
  component: MasterRouteComponent,
})
