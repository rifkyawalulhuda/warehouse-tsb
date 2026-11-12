import { useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import {
  defaultDockView,
  readDockView,
  writeDockView,
  type DockView,
} from './dock-view'

/**
 * Pilihan tampilan dibaca sekali saat papan dipasang. Halaman ini selalu
 * dirender di balik RequireAuth, jadi userId sudah pasti ada — tidak ada
 * kedipan dari tampilan bawaan ke tampilan tersimpan.
 */
export function useDockView() {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const [view, setViewState] = useState<DockView>(() =>
    userId ? readDockView(userId) : defaultDockView
  )

  const setView = useCallback(
    (next: DockView) => {
      setViewState(next)
      writeDockView(userId, next)
    },
    [userId]
  )

  return { view, setView }
}
