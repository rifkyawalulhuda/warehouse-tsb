import type { ActivityType, Prisma, PrismaClient, WarehouseSetting } from '@prisma/client'
import { prisma } from './prisma'
import { listBlockStarts, blocksCoveredBy, type OperatingWindow } from './quota'
import {
  jakartaInstant,
  dateOnlyToUtc,
  utcToDateOnly,
  todayISO,
  type DateISO,
} from './time'

export const SETTINGS_ID = 1

/** Klien minimum yang dibutuhkan helper di sini; cocok untuk prisma maupun tx. */
type DbClient = Pick<PrismaClient, 'slotAllocation' | 'booking'>

/**
 * Baris pengaturan tunggal, dibuat bila belum ada.
 *
 * `upsert`, bukan `findUnique` lalu `create`: dua permintaan pertama pada
 * database yang baru dimigrasi sama-sama melihat `null` dan sama-sama membuat
 * baris. Yang kalah mendapat P2002, dan middleware menerjemahkannya menjadi 409
 * "Data sudah ada" di halaman masuk — galat yang tidak ada hubungannya dengan
 * apa yang sedang dikerjakan pengguna.
 */
export async function getSettings(): Promise<WarehouseSetting> {
  return prisma.warehouseSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  })
}

export function toWindow(settings: WarehouseSetting): OperatingWindow {
  return {
    startMinute: settings.operatingStartMinute,
    endMinute: settings.operatingEndMinute,
    unitMinutes: settings.slotUnitMinutes,
  }
}

/** Jumlah dock aktif yang mengizinkan aktivitas tertentu. Inilah sumber kuota. */
export async function capacityForActivity(activity: ActivityType): Promise<number> {
  return prisma.dock.count({
    where: {
      currentStatus: { not: 'MAINTENANCE' },
      OR: [{ allowedActivity: activity }, { allowedActivity: 'BOTH' }],
    },
  })
}

export async function capacityMap(): Promise<Record<ActivityType, number>> {
  const [loading, unloading] = await Promise.all([
    capacityForActivity('LOADING'),
    capacityForActivity('UNLOADING'),
  ])
  return { LOADING: loading, UNLOADING: unloading }
}

/**
 * Menyiapkan baris slot_allocations untuk satu hari dan satu aktivitas.
 * Baris yang sudah ada tidak diubah kapasitasnya (snapshot historis); hanya
 * baris baru yang mendapat kapasitas terkini.
 */
export async function ensureSlotRows(
  db: DbClient,
  date: DateISO,
  activity: ActivityType,
  window: OperatingWindow,
  capacity: number
): Promise<void> {
  const starts = listBlockStarts(window)
  if (starts.length === 0) return

  const data: Prisma.SlotAllocationCreateManyInput[] = starts.map((slotStartMinute) => ({
    slotDate: dateOnlyToUtc(date),
    activity,
    slotStartMinute,
    capacity,
    used: 0,
  }))

  await db.slotAllocation.createMany({ data, skipDuplicates: true })
}

export function slotStartInstant(date: DateISO, minute: number): Date {
  return jakartaInstant(date, minute)
}

/**
 * Menyusun ulang baris slot hari ini dan seterusnya saat jam buka atau satuan
 * blok berubah.
 *
 * Tanpa ini, `ensureSlotRows` membuat baris baru di grid baru dengan `used: 0`
 * sementara baris grid lama tetap memegang pemakaian booking yang sudah ada.
 * Ketersediaan lalu melaporkan semua slot kosong padahal dock terisi — customer
 * bisa memesan melebihi kapasitas gudang.
 *
 * Pemakaian dihitung ulang dari JAM NYATA setiap booking yang masih memegang
 * kuota (`quota_released_at IS NULL`), bukan dari baris lama: baris lama tidak
 * tahu apakah dua blok 30 menit milik satu truk atau dua truk, sehingga
 * penjumlahan naif bisa menghitung satu truk dua kali. `blocksCoveredBy` memakai
 * irisan waktu, jadi booking yang jamnya tidak sejajar grid baru tetap menempati
 * blok yang benar.
 *
 * Kapasitas baris baru memakai jumlah dock terkini, sama seperti baris yang
 * dibuat `ensureSlotRows`. Tanggal yang sudah lewat tidak disentuh.
 */
export async function rebuildFutureAllocations(
  db: DbClient,
  window: OperatingWindow
): Promise<void> {
  const from = dateOnlyToUtc(todayISO())
  const allocations = await db.slotAllocation.findMany({
    where: { slotDate: { gte: from } },
    distinct: ['slotDate', 'activity'],
    select: { slotDate: true, activity: true },
  })
  if (allocations.length === 0) return

  const bookings = await db.booking.findMany({
    where: { bookingDate: { gte: from }, quotaReleasedAt: null },
    select: { bookingDate: true, activityType: true, startTime: true, endTime: true },
  })

  const key = (date: Date, activity: ActivityType) => `${date.toISOString()}|${activity}`
  const usage = new Map<string, Map<number, number>>()
  for (const booking of bookings) {
    const groupKey = key(booking.bookingDate, booking.activityType)
    let blocks = usage.get(groupKey)
    if (!blocks) {
      blocks = new Map()
      usage.set(groupKey, blocks)
    }
    for (const block of blocksCoveredBy(window, booking.startTime, booking.endTime)) {
      blocks.set(block, (blocks.get(block) ?? 0) + 1)
    }
  }

  const capacity = await capacityMap()
  const starts = listBlockStarts(window)

  for (const allocation of allocations) {
    const used = usage.get(key(allocation.slotDate, allocation.activity)) ?? new Map()
    await db.slotAllocation.deleteMany({
      where: { slotDate: allocation.slotDate, activity: allocation.activity },
    })
    if (starts.length === 0) continue
    await db.slotAllocation.createMany({
      data: starts.map((slotStartMinute) => ({
        slotDate: allocation.slotDate,
        activity: allocation.activity,
        slotStartMinute,
        capacity: capacity[allocation.activity],
        used: used.get(slotStartMinute) ?? 0,
      })),
    })
  }
}

export { dateOnlyToUtc, utcToDateOnly }
