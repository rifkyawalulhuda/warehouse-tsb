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

/**
 * Kode dock berikut areanya untuk tempat sempit: `D1 · Area B`. Nama gudang
 * sengaja tidak ikut — papan operasional, tiket, dan laporan hanya butuh
 * area. Bagian kosong dilewati, dock lama tanpa area tetap terbaca `D1`.
 */
export function dockWithArea(dock: {
  dockCode: string | null
  areaName?: string | null
}): string {
  return [dock.dockCode, dock.areaName]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/** Potongan ` · Area B` untuk ditempel di belakang teks lain; kosong bila tak ada area. */
export function dockAreaSuffix(areaName?: string | null): string {
  return areaName ? ` · ${areaName}` : ''
}
