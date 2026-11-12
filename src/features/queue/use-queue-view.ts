import { useCallback, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import {
  defaultQueueView,
  readQueueView,
  writeQueueView,
  type QueueView,
} from './queue-view'

/**
 * Pilihan tampilan dibaca sekali saat halaman dipasang. Halaman ini selalu
 * dirender di balik RequireAuth, jadi userId sudah pasti ada — tidak ada
 * kedipan dari tampilan bawaan ke tampilan tersimpan.
 */
export function useQueueView() {
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const [view, setViewState] = useState<QueueView>(() =>
    userId ? readQueueView(userId) : defaultQueueView
  )

  const setView = useCallback(
    (next: QueueView) => {
      setViewState(next)
      writeQueueView(userId, next)
    },
    [userId]
  )

  return { view, setView }
}
