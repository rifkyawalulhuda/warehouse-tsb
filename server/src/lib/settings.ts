import type { ActivityType, Prisma, PrismaClient, WarehouseSetting } from '@prisma/client'
import { prisma } from './prisma'
import type { OperatingWindow } from './quota'
import { jakartaInstant, dateOnlyToUtc, utcToDateOnly, type DateISO } from './time'

export const SETTINGS_ID = 1

/** Klien minimum yang dibutuhkan helper di sini; cocok untuk prisma maupun tx. */
type DbClient = Pick<PrismaClient, 'slotAllocation'>

export async function getSettings(): Promise<WarehouseSetting> {
  const existing = await prisma.warehouseSetting.findUnique({ where: { id: SETTINGS_ID } })
  if (existing) return existing
  return prisma.warehouseSetting.create({ data: { id: SETTINGS_ID } })
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

/** Daftar jam mulai blok yang utuh di dalam jam operasional. */
export function blockStarts(window: OperatingWindow): number[] {
  const starts: number[] = []
  for (
    let minute = window.startMinute;
    minute + window.unitMinutes <= window.endMinute;
    minute += window.unitMinutes
  ) {
    starts.push(minute)
  }
  return starts
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
  const starts = blockStarts(window)
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

export { dateOnlyToUtc, utcToDateOnly }
