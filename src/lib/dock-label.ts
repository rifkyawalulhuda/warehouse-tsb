/** Bentuk minimum satu dock untuk menyusun labelnya. */
export type DockOption = {
  id: number
  dockCode: string
  areaName?: string | null
  warehouse?: { id: number; name: string } | null
}

/**
 * Label lengkap satu dock: `L1 · Area Tengah · Warehouse 2`.
 * Bagian yang kosong dilewati, jadi dock lama tanpa area tetap terbaca `L1`.
 */
export function dockOptionLabel(dock: DockOption): string {
  return [dock.dockCode, dock.areaName, dock.warehouse?.name]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/** Keterangan lokasi tanpa kode: `Area Tengah · Warehouse 2`. */
export function dockOptionPlace(dock: DockOption): string {
  return [dock.areaName, dock.warehouse?.name]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}
