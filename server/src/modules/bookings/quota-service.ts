import type { ActivityType } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { conflict } from '../../lib/http-error'
import {
  computeAvailability,
  requiredBlocks,
  type BlockUsage,
  type OperatingWindow,
  type SlotAvailability,
} from '../../lib/quota'
import { ensureSlotRows } from '../../lib/settings'
import { dateOnlyToUtc, type DateISO } from '../../lib/time'

export type QuotaContext = {
  date: DateISO
  activity: ActivityType
  window: OperatingWindow
  capacity: number
}

type LockedRow = {
  id: number
  slot_start_minute: number
  capacity: number
  used: number
}

export async function loadUsage(
  date: DateISO,
  activity: ActivityType
): Promise<BlockUsage> {
  const rows = await prisma.slotAllocation.findMany({
    where: { slotDate: dateOnlyToUtc(date), activity },
    select: { slotStartMinute: true, used: true },
  })
  return new Map(rows.map((row) => [row.slotStartMinute, row.used]))
}

export async function getAvailability(
  ctx: QuotaContext,
  blocksRequired: number
): Promise<SlotAvailability[]> {
  const usage = await loadUsage(ctx.date, ctx.activity)
  return computeAvailability({
    window: ctx.window,
    blocksRequired,
    capacity: ctx.capacity,
    usedByBlock: usage,
  })
}

/**
 * Mengunci baris slot dengan SELECT ... FOR UPDATE, urut menurut jam.
 * Urutan menaik mencegah dua transaksi saling mengunci berlawanan arah.
 */
async function lockSlotRows(
  tx: Tx,
  ctx: QuotaContext,
  blocks: readonly number[]
): Promise<LockedRow[]> {
  // Penting: kolom slot_date bertipe `date`, sedangkan parameter Date dikirim
  // sebagai timestamptz. Kirim string ISO + cast ::date supaya tidak bergantung
  // pada timezone sesi database.
  return tx.$queryRaw<LockedRow[]>`
    SELECT id, slot_start_minute, capacity, used
    FROM slot_allocations
    WHERE slot_date = ${ctx.date}::date
      AND activity = ${ctx.activity}::"ActivityType"
      AND slot_start_minute = ANY(${[...blocks]}::int[])
    ORDER BY slot_start_minute
    FOR UPDATE
  `
}

/**
 * Mengunci blok yang dibutuhkan lalu menambah pemakaian.
 * Harus dipanggil di dalam transaksi. Mengembalikan blok yang dipakai.
 */
export async function reserveBlocks(
  tx: Tx,
  ctx: QuotaContext,
  startMinute: number,
  blocksRequired: number
): Promise<number[]> {
  const blocks = requiredBlocks(ctx.window, startMinute, blocksRequired)

  await ensureSlotRows(tx, ctx.date, ctx.activity, ctx.window, ctx.capacity)

  const locked = await lockSlotRows(tx, ctx, blocks)

  if (locked.length !== blocks.length) {
    throw conflict(
      'SLOT_UNAVAILABLE',
      'Jadwal belum tersedia untuk jam tersebut. Muat ulang halaman lalu coba lagi.'
    )
  }

  for (const row of locked) {
    if (row.used + 1 > row.capacity) {
      throw conflict(
        'QUOTA_FULL',
        'Maaf, kuota pada jam tersebut baru saja terisi. Silakan pilih jam lain.'
      )
    }
  }

  await tx.slotAllocation.updateMany({
    where: { id: { in: locked.map((row) => row.id) } },
    data: { used: { increment: 1 } },
  })

  return blocks
}

/**
 * Mengembalikan kuota satu booking (pembatalan atau NO_SHOW).
 * GREATEST(0, used - 1) menjaga kuota tidak negatif bila dipanggil dua kali.
 */
export async function releaseBlocks(
  tx: Tx,
  params: {
    date: DateISO
    activity: ActivityType
    startMinute: number
    blocksRequired: number
    window: OperatingWindow
  }
): Promise<void> {
  const blocks = requiredBlocks(params.window, params.startMinute, params.blocksRequired)

  await tx.$executeRaw`
    UPDATE slot_allocations
    SET used = GREATEST(0, used - 1)
    WHERE slot_date = ${params.date}::date
      AND activity = ${params.activity}::"ActivityType"
      AND slot_start_minute = ANY(${[...blocks]}::int[])
  `
}
