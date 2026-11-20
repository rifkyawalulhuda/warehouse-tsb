/**
 * Id tab Master Data. Hanya diisi tab yang benar-benar ada di layar; id yang
 * tidak dikenal (mis. dari tautan lama) membuat layar jatuh ke tab Dock.
 */
export const MASTER_TABS = [
  'docks',
  'warehouses',
  'truck-types',
  'customers',
  'users',
] as const

export type MasterTab = (typeof MASTER_TABS)[number]
