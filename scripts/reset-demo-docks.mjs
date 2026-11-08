/**
 * Mengembalikan data demo Master Data ke keadaan seed setelah uji manual:
 * menghapus gudang percobaan dan mengosongkan Nama Area dock.
 *
 * Jalankan: node scripts/reset-demo-docks.mjs
 */
import { PrismaClient } from '../node_modules/@prisma/client/default.js'

const prisma = new PrismaClient()

const main = await prisma.warehouse.findFirstOrThrow({ orderBy: { id: 'asc' } })

const moved = await prisma.dock.updateMany({
  where: { warehouseId: { not: main.id } },
  data: { warehouseId: main.id },
})

const cleared = await prisma.dock.updateMany({
  where: { areaName: { not: null } },
  data: { areaName: null },
})

const removed = await prisma.warehouse.deleteMany({ where: { id: { not: main.id } } })

const docks = await prisma.dock.findMany({
  orderBy: { dockCode: 'asc' },
  include: { warehouse: { select: { name: true } } },
})

console.log(`dipindah: ${moved.count}, area dikosongkan: ${cleared.count}, gudang dihapus: ${removed.count}`)
for (const dock of docks) {
  console.log(`${dock.dockCode} | ${dock.areaName ?? '-'} | ${dock.warehouse.name}`)
}

await prisma.$disconnect()
