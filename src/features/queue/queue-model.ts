import type { Booking, DockWithBooking, QueueResponse } from '@/lib/api/types'

/**
 * Ambang warna jam tunggu memakai satuan blok slot proyek ini (30 menit).
 * Satu blok masih wajar, dua blok mulai mengganggu, tiga blok berarti ada
 * truk yang tertahan terlalu lama di area staging.
 */
export const WAIT_WARN_MINUTES = 30
export const WAIT_LONG_MINUTES = 60

export type WaitTone = 'fresh' | 'waiting' | 'long'

export type WaitClock = {
  minutes: number
  tone: WaitTone
  /// Waktu gate-in, titik awal hitungan.
  since: string
}

/**
 * Lama menunggu dihitung di klien dari `gateInAt`, bukan dari jam server yang
 * bisa tertinggal. Truk yang belum gate-in tidak punya jam tunggu.
 */
export function waitClock(booking: Booking, now: Date): WaitClock | null {
  const since = booking.timeLog?.gateInAt
  if (!since) return null

  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(since)) / 60_000)
  )

  return {
    minutes,
    since,
    tone:
      minutes >= WAIT_LONG_MINUTES
        ? 'long'
        : minutes >= WAIT_WARN_MINUTES
          ? 'waiting'
          : 'fresh',
  }
}

/** Menit menjadi "24 mnt" atau "1 j 05 mnt". */
export function waitLabel(minutes: number) {
  if (minutes < 60) return `${minutes} mnt`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? `${hours} j`
    : `${hours} j ${String(rest).padStart(2, '0')} mnt`
}

export const queueLaneKeys = ['late', 'onTime', 'atDock', 'upcoming'] as const

export type QueueLaneKey = (typeof queueLaneKeys)[number]

/**
 * Warna titik tahap. Tinggal di model, bukan di komponen, supaya papan dan chip
 * saringan memakai warna yang sama dan berkas komponen tetap bisa di-refresh
 * panas oleh Vite.
 */
export const laneDot: Record<QueueLaneKey, string> = {
  late: 'bg-rose-500',
  onTime: 'bg-sky-500',
  atDock: 'bg-violet-500',
  upcoming: 'bg-slate-400',
}

/** Label tahap yang muat di kolom sempit: tab ponsel dan tabel Daftar. */
export const laneShortTitle: Record<QueueLaneKey, string> = {
  late: 'Telat',
  onTime: 'Tepat',
  atDock: 'Di dock',
  upcoming: 'Belum',
}

/** Judul penuh tahap, dipakai bila ruang cukup. */
export const laneTitle: Record<QueueLaneKey, string> = {
  late: 'Terlambat',
  onTime: 'Tepat waktu',
  atDock: 'Di dock',
  upcoming: 'Belum datang',
}

export type QueueLane = {
  key: QueueLaneKey
  title: string
  /** Label pendek untuk tab di layar sempit, tempat lebar sangat terbatas. */
  shortTitle: string
  description: string
  emptyLabel: string
  bookings: Booking[]
}

/**
 * Satu truk beserta tahapnya. Tampilan Daftar, Kartu, dan Ringkas tidak memakai
 * kolom tahap, jadi ketiganya membutuhkan daftar datar yang masih tahu asal
 * lane-nya — urutannya tetap: terlambat, tepat waktu, di dock, belum datang.
 */
export type QueueRow = {
  booking: Booking
  laneKey: QueueLaneKey
}

export function queueRows(
  lanes: QueueLane[],
  filter: QueueLaneKey | 'all'
): QueueRow[] {
  const shown =
    filter === 'all' ? lanes : lanes.filter((lane) => lane.key === filter)

  return shown.flatMap((lane) =>
    lane.bookings.map((booking) => ({ booking, laneKey: lane.key }))
  )
}

function timeOf(value: string | null | undefined) {
  return value ? Date.parse(value) : null
}

/**
 * Truk yang paling lama menunggu didahulukan: gate-in paling awal lebih dulu.
 * Booking tanpa gate-in ditaruh di belakang, lalu diurutkan menurut jadwal.
 */
function byLongestWait(a: Booking, b: Booking) {
  const aIn = timeOf(a.timeLog?.gateInAt)
  const bIn = timeOf(b.timeLog?.gateInAt)
  if (aIn !== null && bIn !== null && aIn !== bIn) return aIn - bIn
  if (aIn === null && bIn !== null) return 1
  if (aIn !== null && bIn === null) return -1
  return a.startTime.localeCompare(b.startTime)
}

function byDockThenWait(a: Booking, b: Booking) {
  const aAssigned = timeOf(a.timeLog?.dockAssignedAt)
  const bAssigned = timeOf(b.timeLog?.dockAssignedAt)
  if (aAssigned !== null && bAssigned !== null && aAssigned !== bAssigned) {
    return aAssigned - bAssigned
  }
  if (aAssigned === null && bAssigned !== null) return 1
  if (aAssigned !== null && bAssigned === null) return -1
  return byLongestWait(a, b)
}

/**
 * Empat lane papan antrean. Urutannya mengikuti kepentingan checker: yang
 * terlambat paling kiri, lalu yang menunggu dock tepat waktu, truk yang sudah
 * di dock, dan terakhir yang belum tiba.
 */
export function queueLanes(queue: QueueResponse): QueueLane[] {
  return [
    {
      key: 'late',
      title: laneTitle.late,
      shortTitle: laneShortTitle.late,
      description: 'Sudah gate-in melewati tenggang waktu. Dahulukan.',
      emptyLabel: 'Tidak ada truk terlambat',
      bookings: [...queue.late].sort(byLongestWait),
    },
    {
      key: 'onTime',
      title: laneTitle.onTime,
      shortTitle: laneShortTitle.onTime,
      description: 'Sudah gate-in sesuai jadwal, menunggu dock kosong.',
      emptyLabel: 'Tidak ada truk menunggu dock',
      bookings: [...queue.onTime].sort(byLongestWait),
    },
    {
      key: 'atDock',
      title: laneTitle.atDock,
      shortTitle: laneShortTitle.atDock,
      description: 'Truk sudah menempati dock — proses dimulai dari Papan Dock.',
      emptyLabel: 'Belum ada truk di dock',
      bookings: [...queue.atDock].sort(byDockThenWait),
    },
    {
      key: 'upcoming',
      title: laneTitle.upcoming,
      shortTitle: laneShortTitle.upcoming,
      description: 'Booking hari ini yang belum dipindai di gate.',
      emptyLabel: 'Semua truk sudah datang',
      bookings: [...queue.upcoming].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    },
  ]
}

export function queueTotals(queue: QueueResponse) {
  const waiting = queue.late.length + queue.onTime.length
  return {
    total: waiting + queue.atDock.length + queue.upcoming.length,
    waiting,
    late: queue.late.length,
    atDock: queue.atDock.length,
  }
}

/** Lane yang dibuka lebih dulu di layar sempit: yang paling perlu tindakan. */
export function defaultLaneKey(lanes: QueueLane[]): QueueLaneKey {
  return lanes.find((lane) => lane.bookings.length > 0)?.key ?? 'late'
}

/**
 * Urutkan kode dock menurut angka di belakangnya, supaya `D2` datang sebelum
 * `D10`. Perbandingan teks biasa menaruh `D10` di antara `D1` dan `D2`, dan
 * penugasan satu klik jadi terasa acak.
 */
function byDockCode(a: DockWithBooking, b: DockWithBooking) {
  const aCode = a.dockCode.match(/^(\D*)(\d+)$/)
  const bCode = b.dockCode.match(/^(\D*)(\d+)$/)
  if (aCode && bCode && aCode[1] === bCode[1]) {
    return Number(aCode[2]) - Number(bCode[2])
  }
  return a.dockCode.localeCompare(b.dockCode)
}

/**
 * Dock bebas pertama yang melayani aktivitas booking ini.
 *
 * Dipakai tombol "Tugaskan" satu klik: dock dipilih menurut kode terkecil, bukan
 * urutan balasan server, supaya checker bisa menebak ke mana truk akan
 * ditempatkan dan kejutan penempatan tidak terjadi. Hasil `null` berarti tidak
 * ada dock bebas yang cocok — kartu wajib mengatakannya, bukan menyembunyikan
 * tombol.
 */
export function firstEligibleDock(
  booking: Pick<Booking, 'activityType'>,
  docks: DockWithBooking[]
): DockWithBooking | null {
  const free = docks
    .filter(
      (dock) =>
        dock.currentStatus === 'AVAILABLE' &&
        (dock.allowedActivity === 'BOTH' ||
          dock.allowedActivity === booking.activityType)
    )
    .sort(byDockCode)

  return free[0] ?? null
}

/** Semua dock yang bisa menerima booking ini, sudah urut kode. */
export function eligibleDocks(
  booking: Pick<Booking, 'activityType'>,
  docks: DockWithBooking[]
): DockWithBooking[] {
  return docks
    .filter(
      (dock) =>
        dock.currentStatus === 'AVAILABLE' &&
        (dock.allowedActivity === 'BOTH' ||
          dock.allowedActivity === booking.activityType)
    )
    .sort(byDockCode)
}

/**
 * Kenapa tombol "tugaskan" tidak muncul. Halaman hanya mengirim dock yang
 * sedang kosong, jadi dua sebab yang mungkin dan keduanya perlu ditulis
 * berbeda: semua dock terpakai, atau yang kosong tidak melayani bongkar/muat
 * truk ini. Tanpa ini checker mengira aplikasinya rusak.
 */
export function assignBlockReason(
  booking: Booking,
  availableDocks: DockWithBooking[]
): string {
  if (availableDocks.length === 0) return 'Semua dock sedang terpakai'
  const activity = booking.activityType === 'UNLOADING' ? 'bongkar' : 'muat'
  return `Dock yang kosong tidak melayani ${activity}`
}

/**
 * Truk yang paling lama menunggu di satu lane, untuk baris ringkas "terlama
 * 42 mnt". `null` bila lane belum berisi truk yang sudah gate-in.
 */
export function oldestWait(lane: QueueLane, now: Date): WaitClock | null {
  let oldest: WaitClock | null = null
  for (const booking of lane.bookings) {
    const clock = waitClock(booking, now)
    if (clock && (!oldest || clock.minutes > oldest.minutes)) oldest = clock
  }
  return oldest
}
