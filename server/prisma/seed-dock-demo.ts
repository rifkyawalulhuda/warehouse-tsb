/**
 * Data contoh untuk Papan Dock.
 *
 * Skrip ini HANYA menambah booking demo bertanda `reference_doc_no` DEMO-DOCK-*
 * pada hari operasional berjalan, supaya papan menampilkan keempat keadaan:
 * proses berjalan (tepat waktu, mendekati target, melewati target), menunggu
 * dimulai, antrean, dan satu dock perawatan.
 *
 * Tidak seperti `seed.ts`, skrip ini tidak mengosongkan database.
 *
 *   npm run db:demo:dock            # pasang/perbarui data demo
 *   npm run db:demo:dock -- --clean # hapus data demo
 *
 * Catatan: dock yang dipakai untuk keadaan "perawatan" adalah dock bebas
 * terakhir, dan `--clean` mengembalikan dock perawatan tanpa booking ke
 * AVAILABLE. Kalau Anda memasang perawatan secara manual, pasang ulang setelah
 * membersihkan demo.
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const prisma = new PrismaClient()
const TZ = 'Asia/Jakarta'
const MARK = 'DEMO-DOCK'

const now = dayjs().tz(TZ)
const todayISO = now.format('YYYY-MM-DD')

function dateOnly(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

function minutesFromNow(minutes: number) {
  return now.add(minutes, 'minute').toDate()
}

function qr() {
  return randomBytes(24).toString('base64url')
}

function minuteOfDay(date: Date) {
  const local = dayjs(date).tz(TZ)
  return local.hour() * 60 + local.minute()
}

type DemoRow = {
  reference: string
  status:
    | 'DOCK_ASSIGNED'
    | 'IN_PROGRESS'
    | 'LATE_WAITING_LIST'
    | 'CHECKED_IN_ON_TIME'
    | 'COMPLETED'
  activity: 'LOADING' | 'UNLOADING'
  dockId: number | null
  plate: string
  driver: string
  customerId: string
  startOffset: number
  endOffset: number
  gateInOffset: number | null
  dockAssignedOffset: number | null
  processStartedOffset: number | null
  processCompletedOffset: number | null
  lateMinutes: number
}

async function resetDocks() {
  // Dock yang ditandai OCCUPIED tetapi tidak punya booking aktif bisa tertinggal
  // dari demo sebelumnya, jadi dikembalikan ke AVAILABLE.
  const stale = await prisma.dock.findMany({
    where: {
      currentStatus: 'OCCUPIED',
      bookings: {
        none: { status: { in: ['DOCK_ASSIGNED', 'IN_PROGRESS'] } },
      },
    },
    select: { id: true },
  })

  if (stale.length > 0) {
    await prisma.dock.updateMany({
      where: { id: { in: stale.map((dock) => dock.id) } },
      data: { currentStatus: 'AVAILABLE' },
    })
  }

  const maintenance = await prisma.dock.findMany({
    where: {
      currentStatus: 'MAINTENANCE',
      bookings: {
        none: { status: { in: ['DOCK_ASSIGNED', 'IN_PROGRESS'] } },
      },
    },
    select: { id: true },
  })

  if (maintenance.length > 0) {
    await prisma.dock.updateMany({
      where: { id: { in: maintenance.map((dock) => dock.id) } },
      data: { currentStatus: 'AVAILABLE' },
    })
  }
}

async function clean() {
  const demos = await prisma.booking.findMany({
    where: { referenceDocNo: { startsWith: MARK } },
    select: {
      activityType: true,
      startTime: true,
      blocksLocked: true,
    },
  })

  // Kuota yang sempat dipakai demo dikembalikan, supaya slot tidak tampak
  // penuh setelah demo dihapus.
  for (const demo of demos) {
    for (let block = 0; block < demo.blocksLocked; block += 1) {
      await prisma.slotAllocation.updateMany({
        where: {
          slotDate: dateOnly(todayISO),
          activity: demo.activityType,
          slotStartMinute: minuteOfDay(demo.startTime) + block * 30,
        },
        data: { used: { decrement: 1 } },
      })
    }
  }

  const { count } = await prisma.booking.deleteMany({
    where: { referenceDocNo: { startsWith: MARK } },
  })

  await resetDocks()

  console.log(`[demo] ${count} booking demo dihapus.`)
}

async function main() {
  const onlyClean = process.argv.includes('--clean')

  await clean()
  if (onlyClean) return

  const [admin, customers, truckTypes, docks, active] = await Promise.all([
    prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } }),
    prisma.customer.findMany({ orderBy: { code: 'asc' }, take: 3 }),
    prisma.truckType.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.dock.findMany({ orderBy: { dockCode: 'asc' } }),
    prisma.booking.findMany({
      where: {
        bookingDate: dateOnly(todayISO),
        status: { in: ['DOCK_ASSIGNED', 'IN_PROGRESS'] },
      },
      select: { assignedDockId: true },
    }),
  ])

  if (!admin) throw new Error('Tidak ada user ADMIN. Jalankan npm run db:seed dulu.')
  if (customers.length === 0) throw new Error('Tidak ada customer. Jalankan npm run db:seed dulu.')
  if (truckTypes.length === 0) throw new Error('Tidak ada jenis truk. Jalankan npm run db:seed dulu.')

  const occupied = new Set(active.map((row) => row.assignedDockId))
  const free = docks.filter(
    (dock) => dock.currentStatus !== 'MAINTENANCE' && !occupied.has(dock.id)
  )

  if (free.length < 3) {
    throw new Error(
      `Butuh 3 dock bebas untuk demo, tersedia ${free.length}. Kosongkan dock atau kurangi booking hari ini.`
    )
  }

  const [dockA, dockB, dockC] = free
  const maintenanceDock = free[3] ?? null
  const truck = truckTypes[0]

  const rows: DemoRow[] = [
    {
      reference: `${MARK}-1`,
      status: 'IN_PROGRESS',
      activity: 'UNLOADING',
      dockId: dockA.id,
      plate: 'B 9021 KHD',
      driver: 'Slamet Riyadi',
      customerId: customers[0].id,
      startOffset: -125,
      endOffset: -65,
      gateInOffset: -138,
      dockAssignedOffset: -120,
      processStartedOffset: -95,
      processCompletedOffset: null,
      lateMinutes: 0,
    },
    {
      reference: `${MARK}-2`,
      status: 'IN_PROGRESS',
      activity: 'LOADING',
      dockId: dockB.id,
      plate: 'D 4412 AB',
      driver: 'Agus Setiawan',
      customerId: customers[1]?.id ?? customers[0].id,
      startOffset: -55,
      endOffset: 5,
      gateInOffset: -62,
      dockAssignedOffset: -50,
      processStartedOffset: -52,
      processCompletedOffset: null,
      lateMinutes: 0,
    },
    {
      reference: `${MARK}-3`,
      status: 'DOCK_ASSIGNED',
      activity: 'UNLOADING',
      dockId: dockC.id,
      plate: 'F 7710 XY',
      driver: 'Hendra',
      customerId: customers[2]?.id ?? customers[0].id,
      startOffset: -10,
      endOffset: 50,
      gateInOffset: -14,
      dockAssignedOffset: -6,
      processStartedOffset: null,
      processCompletedOffset: null,
      lateMinutes: 0,
    },
    {
      reference: `${MARK}-4`,
      status: 'LATE_WAITING_LIST',
      activity: 'UNLOADING',
      dockId: null,
      plate: 'B 1188 TR',
      driver: 'Wawan',
      customerId: customers[0].id,
      startOffset: -40,
      endOffset: 20,
      gateInOffset: -32,
      dockAssignedOffset: null,
      processStartedOffset: null,
      processCompletedOffset: null,
      lateMinutes: 18,
    },
    {
      reference: `${MARK}-5`,
      status: 'CHECKED_IN_ON_TIME',
      activity: 'LOADING',
      dockId: null,
      plate: 'D 2201 QQ',
      driver: 'Rudi',
      customerId: customers[1]?.id ?? customers[0].id,
      startOffset: -5,
      endOffset: 55,
      gateInOffset: -7,
      dockAssignedOffset: null,
      processStartedOffset: null,
      processCompletedOffset: null,
      lateMinutes: 0,
    },
    {
      reference: `${MARK}-6`,
      status: 'CHECKED_IN_ON_TIME',
      activity: 'LOADING',
      dockId: null,
      plate: 'B 5533 MN',
      driver: 'Fajar',
      customerId: customers[2]?.id ?? customers[0].id,
      startOffset: 20,
      endOffset: 80,
      gateInOffset: -3,
      dockAssignedOffset: null,
      processStartedOffset: null,
      processCompletedOffset: null,
      lateMinutes: 0,
    },
  ]

  const usedCodes = new Set(
    (
      await prisma.booking.findMany({
        where: { bookingDate: dateOnly(todayISO) },
        select: { bookingCode: true },
      })
    ).map((row) => row.bookingCode)
  )

  let sequence = 890
  let created = 0

  for (const row of rows) {
    while (usedCodes.has(`TSB-${todayISO.replace(/-/g, '')}-${sequence}`)) {
      sequence += 1
    }
    const bookingCode = `TSB-${todayISO.replace(/-/g, '')}-${sequence}`
    usedCodes.add(bookingCode)
    sequence += 1

    const startTime = minutesFromNow(row.startOffset)
    const endTime = minutesFromNow(row.endOffset)

    await prisma.booking.create({
      data: {
        bookingCode,
        qrToken: qr(),
        customerId: row.customerId,
        createdById: admin.id,
        activityType: row.activity,
        truckTypeId: truck.id,
        bookingDate: dateOnly(todayISO),
        startTime,
        endTime,
        referenceDocNo: row.reference,
        licensePlate: row.plate,
        driverName: row.driver,
        driverPhone: '081299998888',
        blocksLocked: truck.blocksRequired,
        assignedDockId: row.dockId,
        status: row.status,
        lateMinutes: row.lateMinutes,
        timeLog: {
          create: {
            vehicleCompletedAt: minutesFromNow(-150),
            gateInAt:
              row.gateInOffset === null ? null : minutesFromNow(row.gateInOffset),
            dockAssignedAt:
              row.dockAssignedOffset === null
                ? null
                : minutesFromNow(row.dockAssignedOffset),
            processStartedAt:
              row.processStartedOffset === null
                ? null
                : minutesFromNow(row.processStartedOffset),
            processCompletedAt:
              row.processCompletedOffset === null
                ? null
                : minutesFromNow(row.processCompletedOffset),
          },
        },
      },
    })

    for (let block = 0; block < truck.blocksRequired; block += 1) {
      await prisma.slotAllocation.updateMany({
        where: {
          slotDate: dateOnly(todayISO),
          activity: row.activity,
          slotStartMinute: minuteOfDay(startTime) + block * 30,
        },
        data: { used: { increment: 1 } },
      })
    }

    created += 1
    console.log(
      `[demo] ${bookingCode}  ${row.status.padEnd(19)} ${row.dockId ? `dock ${row.dockId}` : 'antrean'}  ${row.plate}`
    )
  }

  const dockRows = [dockA, dockB, dockC]
  await prisma.dock.updateMany({
    where: { id: { in: dockRows.map((dock) => dock.id) } },
    data: { currentStatus: 'OCCUPIED' },
  })

  if (maintenanceDock) {
    await prisma.dock.update({
      where: { id: maintenanceDock.id },
      data: { currentStatus: 'MAINTENANCE' },
    })
  }

  console.log(
    `\n[demo] ${created} booking demo dibuat untuk ${todayISO} ` +
      `(dock ${dockRows.map((dock) => dock.dockCode).join(', ')}${
        maintenanceDock ? `, perawatan ${maintenanceDock.dockCode}` : ''
      }).`
  )
  console.log('[demo] hapus dengan: npm run db:demo:dock -- --clean')
}

main()
  .catch((error) => {
    console.error('[demo] gagal:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
