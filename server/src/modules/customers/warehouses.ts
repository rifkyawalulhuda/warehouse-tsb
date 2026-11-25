import { prisma } from '../../lib/prisma'

/**
 * Gudang yang boleh dipakai satu customer.
 *
 * Array kosong berarti TIDAK DIBATASI, bukan "tidak boleh apa pun": customer
 * lama yang belum pernah diatur harus tetap bisa ditugaskan ke semua gudang.
 * Itulah sebabnya pemanggil memakai `length > 0` sebagai penanda ada batasan.
 */
export type WarehouseRule = number[]

/** Bagian client Prisma yang dibutuhkan; sah untuk `prisma` maupun `tx`. */
type Db = Pick<typeof prisma, 'customerWarehouse'>

/** Batasan satu customer, dibaca dalam transaksi pemanggil bila perlu. */
export async function customerWarehouseRule(
  customerId: string,
  db: Db = prisma
): Promise<WarehouseRule> {
  const rows = await db.customerWarehouse.findMany({
    where: { customerId },
    select: { warehouseId: true },
  })
  return rows.map((row) => row.warehouseId)
}

/**
 * Batasan banyak customer sekaligus, untuk daftar antrean.
 *
 * Hanya customer yang punya baris yang masuk peta. Yang tidak ada di peta
 * berarti tidak dibatasi — pemanggil tidak perlu membedakan `undefined` dari
 * array kosong.
 */
export async function warehouseRulesByCustomer(
  customerIds: string[]
): Promise<Map<string, WarehouseRule>> {
  const unique = [...new Set(customerIds)]
  if (unique.length === 0) return new Map()

  const rows = await prisma.customerWarehouse.findMany({
    where: { customerId: { in: unique } },
    select: { customerId: true, warehouseId: true },
  })

  const map = new Map<string, WarehouseRule>()
  for (const row of rows) {
    const list = map.get(row.customerId)
    if (list) list.push(row.warehouseId)
    else map.set(row.customerId, [row.warehouseId])
  }
  return map
}

/**
 * Apakah customer boleh memakai dock di gudang ini.
 *
 * Aturan kosong = boleh. Dipakai server sebagai penjaga terakhir, dan disalin
 * ke klien lewat `customer.warehouseIds` supaya pemilih dock menyembunyikan
 * pilihan yang akan ditolak.
 */
export function warehouseAllowed(rule: WarehouseRule | undefined, warehouseId: number | null | undefined): boolean {
  if (!rule || rule.length === 0) return true
  if (warehouseId === null || warehouseId === undefined) return false
  return rule.includes(warehouseId)
}