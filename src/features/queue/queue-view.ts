/**
 * Tampilan halaman Antrean. Keempatnya memuat truk yang sama — yang berbeda
 * hanya kerapatan dan tujuan pembacaannya: memantau per tahap (papan), memindai
 * banyak baris (daftar), bekerja satu truk (kartu), atau membaca cepat satu
 * layar penuh (ringkas).
 *
 * Pilihan disimpan per akun, sama seperti Papan Dock, supaya checker yang
 * berganti perangkat tidak kehilangan kebiasaannya.
 */
export const queueViews = ['board', 'list', 'cards', 'compact'] as const

export type QueueView = (typeof queueViews)[number]

export const defaultQueueView: QueueView = 'board'

export const queueViewLabels: Record<QueueView, string> = {
  board: 'Papan',
  list: 'Daftar',
  cards: 'Kartu',
  compact: 'Ringkas',
}

const storagePrefix = 'tsb.queue.view'

export function queueViewStorageKey(userId: string) {
  return `${storagePrefix}:${userId}`
}

export function isQueueView(value: unknown): value is QueueView {
  return (
    typeof value === 'string' && (queueViews as readonly string[]).includes(value)
  )
}

/** Hanya bagian Storage yang dipakai; localStorage asli juga memenuhi bentuk ini. */
export type QueueViewStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): QueueViewStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Beberapa peramban melempar galat saat localStorage diakses di mode privat.
    return null
  }
}

export function readQueueView(
  userId: string,
  storage: QueueViewStorage | null = browserStorage()
): QueueView {
  if (!storage || !userId) return defaultQueueView
  try {
    const raw = storage.getItem(queueViewStorageKey(userId))
    return isQueueView(raw) ? raw : defaultQueueView
  } catch {
    return defaultQueueView
  }
}

export function writeQueueView(
  userId: string,
  view: QueueView,
  storage: QueueViewStorage | null = browserStorage()
) {
  if (!storage || !userId) return
  try {
    storage.setItem(queueViewStorageKey(userId), view)
  } catch {
    // Kuota penuh atau mode privat: pilihan tetap berlaku untuk sesi ini.
  }
}
