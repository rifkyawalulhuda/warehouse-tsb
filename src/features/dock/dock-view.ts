/**
 * Tampilan papan dock. Ketiganya menampilkan data yang sama — yang berbeda
 * hanya kerapatan dan seberapa banyak detail per dock. Pilihan disimpan per
 * akun supaya checker yang berganti perangkat tidak kehilangan kebiasaannya.
 */
export const dockViews = ['cards', 'table', 'grid'] as const

export type DockView = (typeof dockViews)[number]

export const defaultDockView: DockView = 'cards'

export const dockViewLabels: Record<DockView, string> = {
  cards: 'Kartu',
  table: 'Tabel',
  grid: 'Grid',
}

const storagePrefix = 'tsb.dock.view'

export function dockViewStorageKey(userId: string) {
  return `${storagePrefix}:${userId}`
}

export function isDockView(value: unknown): value is DockView {
  return (
    typeof value === 'string' && (dockViews as readonly string[]).includes(value)
  )
}

/** Hanya bagian Storage yang dipakai; localStorage asli pun memenuhi bentuk ini. */
export type DockViewStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): DockViewStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Beberapa peramban melempar galat saat localStorage diakses di mode privat.
    return null
  }
}

export function readDockView(
  userId: string,
  storage: DockViewStorage | null = browserStorage()
): DockView {
  if (!storage || !userId) return defaultDockView
  try {
    const raw = storage.getItem(dockViewStorageKey(userId))
    return isDockView(raw) ? raw : defaultDockView
  } catch {
    return defaultDockView
  }
}

export function writeDockView(
  userId: string,
  view: DockView,
  storage: DockViewStorage | null = browserStorage()
) {
  if (!storage || !userId) return
  try {
    storage.setItem(dockViewStorageKey(userId), view)
  } catch {
    // Kuota penuh atau mode privat: pilihan tetap berlaku untuk sesi ini.
  }
}
