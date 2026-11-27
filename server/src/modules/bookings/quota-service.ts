import type { ActivityType } from '@prisma/client'
import { prisma, type Tx } from '../../lib/prisma'
import { conflict } from '../../lib/http-error'
import {
  blocksCoveredBy,
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
 *
 * JANGAN panggil fungsi ini langsung dari route/job baru. Gunakan
 * `finalizeRelease`, yang menjaga agar kuota dirilis tepat sekali.
 */
export async function releaseBlocks(
  tx: Tx,
  params: {
    date: DateISO
    activity: ActivityType
    /** Blok final di grid yang berlaku sekarang. */
    blocks: readonly number[]
  }
): Promise<void> {
  const unique = [...new Set(params.blocks)]
  if (unique.length === 0) return

  await tx.$executeRaw`
    UPDATE slot_allocations
    SET used = GREATEST(0, used - 1)
    WHERE slot_date = ${params.date}::date
      AND activity = ${params.activity}::"ActivityType"
      AND slot_start_minute = ANY(${unique}::int[])
  `
}

/**
 * Blok mana yang harus dilepas.
 *
 * Diutamakan blok hasil hitung ulang dari jam nyata booking pada grid yang
 * berlaku sekarang — sama seperti `rebuildFutureAllocations` menempatkan
 * pemakaiannya, sehingga penempatan dan pelepasan selalu sepakat.
 *
 * Snapshot `bookings.block_starts` ikut dilepas sebagai jaring pengaman untuk
 * basis data yang belum pernah disusun ulang (mis. pengaturan diubah langsung
 * di database, atau sebelum perbaikan ini terpasang): baris slotnya masih di
 * grid lama, dan tanpa snapshot pemakaian itu tidak akan pernah kembali nol.
 * Saat baris sudah di grid baru, blok snapshot selalu berada di dalam rentang
 * jam booking sehingga sudah termasuk hasil hitung ulang — penambahannya tidak
 * mengurangi blok milik booking lain.
 *
 * Bila `start_time`/`end_time` tidak bisa dipakai, jatuh ke hitungan lama —
 * tanpa melempar `SlotRangeError`, karena pelepasan kuota terjadi di dalam
 * pembatalan, penolakan, dan job berkala; galat aritmetika di sini tidak boleh
 * menghentikan ketiganya.
 */
function blocksToRelease(params: {
  startMinute: number
  blocksRequired: number
  startTime: Date | null
  endTime: Date | null
  blockStarts: readonly number[] | null
  window: OperatingWindow
}): number[] {
  const blocks = new Set<number>(params.blockStarts ?? [])

  if (params.startTime && params.endTime) {
    for (const block of blocksCoveredBy(params.window, params.startTime, params.endTime)) {
      blocks.add(block)
    }
  }

  if (blocks.size === 0) {
    try {
      for (const block of requiredBlocks(
        params.window,
        params.startMinute,
        params.blocksRequired
      )) {
        blocks.add(block)
      }
    } catch {
      // Pengaturan sudah berubah sejak booking ini dibuat. Lepas blok berurutan
      // dari jam mulainya; baris yang tidak ada cukup diabaikan oleh UPDATE.
      for (let i = 0; i < Math.max(0, params.blocksRequired); i += 1) {
        blocks.add(params.startMinute + i * params.window.unitMinutes)
      }
    }
  }

  return [...blocks]
}

/**
 * Satu-satunya pintu pelepasan kuota.
 *
 * Ada lima jalur yang bisa mengakhiri booking dan mengembalikan slot: cancel
 * customer, reject Admin, job expire, NO_SHOW manual, dan job NO_SHOW. Kalau
 * masing-masing memanggil `releaseBlocks` sendiri, dua jalur yang berjalan
 * berdekatan (mis. Admin approve tepat saat job expire) akan melepas kuota dua
 * kali dan slot milik booking lain ikut terpakai. `GREATEST(0, ...)` menyembunyikan
 * kerusakannya, jadi gejala barunya adalah "slot penuh padahal kosong" berbulan
 * kemudian.
 *
 * Guard-nya adalah UPDATE bersyarat pada `quota_released_at`. Hanya satu
 * transaksi yang bisa menang, tanpa perlu lock eksplisit.
 *
 * Blok yang dilepas dibaca dari `bookings.block_starts` di dalam UPDATE yang
 * sama, bukan dari argumen pemanggil. Dengan begitu tidak ada jalur yang bisa
 * lupa mengirim snapshot dan diam-diam kembali menghitung ulang dari pengaturan
 * yang berlaku sekarang.
 *
 * @returns true bila kuota benar-benar dilepas oleh pemanggil ini; false bila
 * sebelumnya sudah pernah dilepas (atau booking tidak ada).
 */
export async function finalizeRelease(
  tx: Tx,
  params: {
    bookingId: string
    date: DateISO
    activity: ActivityType
    startMinute: number
    blocksRequired: number
    window: OperatingWindow
  }
): Promise<boolean> {
  const claimed = await tx.$queryRaw<
    Array<{ start_time: Date; end_time: Date; block_starts: number[] }>
  >`
    UPDATE bookings
    SET quota_released_at = now()
    WHERE id = ${params.bookingId}::uuid
      AND quota_released_at IS NULL
    RETURNING start_time, end_time, block_starts
  `

  if (claimed.length === 0) return false

  const row = claimed[0]!
  await releaseBlocks(tx, {
    date: params.date,
    activity: params.activity,
    blocks: blocksToRelease({
      startMinute: params.startMinute,
      blocksRequired: params.blocksRequired,
      startTime: row.start_time,
      endTime: row.end_time,
      blockStarts: row.block_starts,
      window: params.window,
    }),
  })

  return true
}
