import { PrismaClient, type ActivityType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const prisma = new PrismaClient()
const TZ = 'Asia/Jakarta'

const PASSWORD = 'Rahasia123'
let hash = ''

function instant(dateISO: string, minute: number): Date {
  return dayjs.tz(`${dateISO}T00:00:00`, TZ).add(minute, 'minute').toDate()
}

function dateOnly(dateISO: string): Date {
  return new Date(`${dateISO}T00:00:00.000Z`)
}

function qr(): string {
  return randomBytes(24).toString('base64url')
}

const today = dayjs().tz(TZ).format('YYYY-MM-DD')
const tomorrow = dayjs().tz(TZ).add(1, 'day').format('YYYY-MM-DD')
const yesterday = dayjs().tz(TZ).subtract(1, 'day').format('YYYY-MM-DD')

async function main() {
  hash = await bcrypt.hash(PASSWORD, 10)
  console.log(`[seed] hari operasional: ${today}`)

  await prisma.auditLog.deleteMany()
  await prisma.bookingTimeLog.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.slotAllocation.deleteMany()
  await prisma.bookingDaySequence.deleteMany()
  await prisma.dock.deleteMany()
  await prisma.truckType.deleteMany()
  await prisma.user.deleteMany()
  await prisma.warehouseSetting.deleteMany()

  await prisma.warehouseSetting.create({
    data: {
      id: 1,
      warehouseName: 'Gudang TSB Cikarang',
      operatingStartMinute: 8 * 60,
      operatingEndMinute: 17 * 60,
      slotUnitMinutes: 30,
      gracePeriodMinutes: 15,
      earlyArrivalLimitMinutes: 60,
      bookingWindowDays: 7,
    },
  })

  const [cddLong, fuso, tronton, container40] = await Promise.all([
    prisma.truckType.create({
      data: { truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2, sortOrder: 1 },
    }),
    prisma.truckType.create({
      data: { truckName: 'Fuso', durationMinutes: 60, blocksRequired: 2, sortOrder: 2 },
    }),
    prisma.truckType.create({
      data: { truckName: 'Tronton', durationMinutes: 90, blocksRequired: 3, sortOrder: 3 },
    }),
    prisma.truckType.create({
      data: { truckName: 'Container 40ft', durationMinutes: 120, blocksRequired: 4, sortOrder: 4 },
    }),
  ])

  const docks = await Promise.all(
    [
      { dockCode: 'D1', allowedActivity: 'UNLOADING' as const },
      { dockCode: 'D2', allowedActivity: 'UNLOADING' as const },
      { dockCode: 'D3', allowedActivity: 'UNLOADING' as const },
      { dockCode: 'D4', allowedActivity: 'UNLOADING' as const },
      { dockCode: 'L1', allowedActivity: 'LOADING' as const },
      { dockCode: 'L2', allowedActivity: 'LOADING' as const },
    ].map((data) => prisma.dock.create({ data }))
  )
  console.log(`[seed] ${docks.length} dock, ${4} jenis truk`)

  const [admin, customerA, customerB, _gateA, _gateB, _checkerA, _checkerB] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Rina Kusuma',
        email: 'admin@tsb.test',
        companyName: 'TSB Warehouse',
        phone: '081200000001',
        role: 'ADMIN',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Budi Santoso',
        email: 'customer@tsb.test',
        companyName: 'PT Sinar Jaya Logistik',
        phone: '081200000002',
        role: 'CUSTOMER',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Siti Rahayu',
        email: 'customer2@tsb.test',
        companyName: 'CV Mitra Niaga',
        phone: '081200000003',
        role: 'CUSTOMER',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Agus Pratama',
        email: 'gate@tsb.test',
        phone: '081200000004',
        role: 'GATE_OFFICER',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Dewi Lestari',
        email: 'gate2@tsb.test',
        phone: '081200000005',
        role: 'GATE_OFFICER',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Hendra Wijaya',
        email: 'checker@tsb.test',
        phone: '081200000006',
        role: 'CHECKER',
        passwordHash: hash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Yusuf Maulana',
        email: 'checker2@tsb.test',
        phone: '081200000007',
        role: 'CHECKER',
        passwordHash: hash,
      },
    }),
  ])
  console.log('[seed] 7 akun pengguna')

  // ---------------------------------------------------------------- hari ini
  type SeedBooking = {
    customerId: string
    activity: ActivityType
    truckTypeId: number
    blocks: number
    startMinute: number
    dockId?: number
    status:
      | 'BOOKED_INCOMPLETE'
      | 'BOOKED_READY'
      | 'CHECKED_IN_ON_TIME'
      | 'LATE_WAITING_LIST'
      | 'DOCK_ASSIGNED'
      | 'IN_PROGRESS'
      | 'COMPLETED'
      | 'CHECKED_OUT'
    lateMinutes?: number
    gateInAt?: Date
    dockAssignedAt?: Date
    processStartedAt?: Date
    processCompletedAt?: Date
    gateOutAt?: Date
    reference: string
    plate?: string
    driver?: string
  }

  const seeding: SeedBooking[] = [
    {
      customerId: customerA.id,
      activity: 'UNLOADING',
      truckTypeId: container40.id,
      blocks: 4,
      startMinute: 8 * 60,
      dockId: docks[0]!.id,
      status: 'CHECKED_OUT',
      reference: 'DO-2601-0001',
      plate: 'B 9421 KXD',
      driver: 'Slamet Riyadi',
      gateInAt: instant(today, 8 * 60 - 5),
      dockAssignedAt: instant(today, 8 * 60 + 2),
      processStartedAt: instant(today, 8 * 60 + 10),
      processCompletedAt: instant(today, 9 * 60 + 35),
      gateOutAt: instant(today, 9 * 60 + 45),
    },
    {
      customerId: customerB.id,
      activity: 'UNLOADING',
      truckTypeId: cddLong.id,
      blocks: 2,
      startMinute: 9 * 60,
      dockId: docks[1]!.id,
      status: 'IN_PROGRESS',
      reference: 'DO-2601-0002',
      plate: 'B 8812 TRC',
      driver: 'Joko Prasetyo',
      gateInAt: instant(today, 9 * 60 + 3),
      dockAssignedAt: instant(today, 9 * 60 + 8),
      processStartedAt: instant(today, 9 * 60 + 20),
    },
    {
      customerId: customerA.id,
      activity: 'UNLOADING',
      truckTypeId: fuso.id,
      blocks: 2,
      startMinute: 10 * 60,
      dockId: docks[2]!.id,
      status: 'DOCK_ASSIGNED',
      reference: 'DO-2601-0003',
      plate: 'B 7711 NVX',
      driver: 'Rahmat Hidayat',
      gateInAt: instant(today, 10 * 60 - 12),
      dockAssignedAt: instant(today, 10 * 60 - 2),
    },
    {
      customerId: customerB.id,
      activity: 'UNLOADING',
      truckTypeId: tronton.id,
      blocks: 3,
      startMinute: 9 * 60 + 30,
      status: 'LATE_WAITING_LIST',
      lateMinutes: 42,
      reference: 'DO-2601-0004',
      plate: 'B 6655 WZ',
      driver: 'Sugianto',
      gateInAt: instant(today, 10 * 60 + 12),
    },
    {
      customerId: customerA.id,
      activity: 'LOADING',
      truckTypeId: cddLong.id,
      blocks: 2,
      startMinute: 11 * 60,
      status: 'CHECKED_IN_ON_TIME',
      reference: 'DO-2601-0005',
      plate: 'B 3344 QP',
      driver: 'Wawan Setiawan',
      gateInAt: instant(today, 10 * 60 + 55),
    },
    {
      customerId: customerB.id,
      activity: 'LOADING',
      truckTypeId: fuso.id,
      blocks: 2,
      startMinute: 13 * 60,
      status: 'BOOKED_READY',
      reference: 'DO-2601-0006',
      plate: 'B 2211 LM',
      driver: 'Endang Saputra',
    },
    {
      customerId: customerA.id,
      activity: 'UNLOADING',
      truckTypeId: cddLong.id,
      blocks: 2,
      startMinute: 14 * 60,
      status: 'BOOKED_INCOMPLETE',
      reference: 'DO-2601-0007',
    },
  ]

  // ---------------------------------------------------------------- besok
  const seedingTomorrow: SeedBooking[] = [
    {
      customerId: customerB.id,
      activity: 'UNLOADING',
      truckTypeId: container40.id,
      blocks: 4,
      startMinute: 8 * 60,
      status: 'BOOKED_READY',
      reference: 'DO-2602-0001',
      plate: 'B 9911 ZA',
      driver: 'Iwan Kurniawan',
    },
    {
      customerId: customerA.id,
      activity: 'LOADING',
      truckTypeId: cddLong.id,
      blocks: 2,
      startMinute: 9 * 60,
      status: 'BOOKED_INCOMPLETE',
      reference: 'DO-2602-0002',
    },
  ]

  // ---------------------------------------------------------------- kemarin
  const seedingYesterday: SeedBooking[] = [
    {
      customerId: customerA.id,
      activity: 'UNLOADING',
      truckTypeId: fuso.id,
      blocks: 2,
      startMinute: 9 * 60,
      dockId: docks[0]!.id,
      status: 'CHECKED_OUT',
      reference: 'DO-2600-0001',
      plate: 'B 1234 AB',
      driver: 'Tarno',
      gateInAt: instant(yesterday, 9 * 60 - 3),
      dockAssignedAt: instant(yesterday, 9 * 60 + 1),
      processStartedAt: instant(yesterday, 9 * 60 + 6),
      processCompletedAt: instant(yesterday, 10 * 60 + 5),
      gateOutAt: instant(yesterday, 10 * 60 + 14),
    },
    {
      customerId: customerB.id,
      activity: 'UNLOADING',
      truckTypeId: cddLong.id,
      blocks: 2,
      startMinute: 15 * 60,
      status: 'NO_SHOW',
      reference: 'DO-2600-0002',
    },
  ]

  const settings = await prisma.warehouseSetting.findUniqueOrThrow({ where: { id: 1 } })
  const capacity = {
    UNLOADING: docks.filter(
      (d) => d.allowedActivity === 'UNLOADING' || d.allowedActivity === 'BOTH'
    ).length,
    LOADING: docks.filter(
      (d) => d.allowedActivity === 'LOADING' || d.allowedActivity === 'BOTH'
    ).length,
  }

  const allRows = [
    ...seeding.map((b) => ({ ...b, date: today })),
    ...seedingTomorrow.map((b) => ({ ...b, date: tomorrow })),
    ...seedingYesterday.map((b) => ({ ...b, date: yesterday })),
  ]

  // Siapkan seluruh baris slot untuk tiga hari, lalu tandai pemakaian.
  for (const date of [yesterday, today, tomorrow]) {
    for (const activity of ['UNLOADING', 'LOADING'] as ActivityType[]) {
      const starts: number[] = []
      for (
        let m = settings.operatingStartMinute;
        m + settings.slotUnitMinutes <= settings.operatingEndMinute;
        m += settings.slotUnitMinutes
      ) {
        starts.push(m)
      }
      await prisma.slotAllocation.createMany({
        data: starts.map((slotStartMinute) => ({
          slotDate: dateOnly(date),
          activity,
          slotStartMinute,
          capacity: capacity[activity],
          used: 0,
        })),
        skipDuplicates: true,
      })
    }
  }

  const seqCounter = new Map<string, number>()

  for (const item of allRows) {
    const next = (seqCounter.get(item.date) ?? 0) + 1
    seqCounter.set(item.date, next)

    const startTime = instant(item.date, item.startMinute)
    const endTime = new Date(
      startTime.getTime() + item.blocks * settings.slotUnitMinutes * 60_000
    )

    const booking = await prisma.booking.create({
      data: {
        bookingCode: `TSB-${item.date.replace(/-/g, '')}-${String(next).padStart(3, '0')}`,
        qrToken: qr(),
        customerId: item.customerId,
        activityType: item.activity,
        truckTypeId: item.truckTypeId,
        bookingDate: dateOnly(item.date),
        startTime,
        endTime,
        referenceDocNo: item.reference,
        licensePlate: item.plate ?? null,
        driverName: item.driver ?? null,
        driverPhone: item.plate ? '081299998888' : null,
        assignedDockId: item.dockId ?? null,
        status: item.status,
        lateMinutes: item.lateMinutes ?? 0,
        timeLog: {
          create: {
            vehicleCompletedAt: item.plate ? new Date() : null,
            gateInAt: item.gateInAt ?? null,
            dockAssignedAt: item.dockAssignedAt ?? null,
            processStartedAt: item.processStartedAt ?? null,
            processCompletedAt: item.processCompletedAt ?? null,
            gateOutAt: item.gateOutAt ?? null,
          },
        },
      },
    })

    // Pemakaian kuota: setiap blok yang tertutup bertambah 1.
    for (let i = 0; i < item.blocks; i += 1) {
      const blockMinute = item.startMinute + i * settings.slotUnitMinutes
      await prisma.slotAllocation.updateMany({
        where: {
          slotDate: dateOnly(item.date),
          activity: item.activity,
          slotStartMinute: blockMinute,
        },
        data: { used: { increment: 1 } },
      })
    }

    if (item.status === 'NO_SHOW') {
      // No-show sudah mengembalikan kuota, jadi blok di atas dikembalikan lagi.
      for (let i = 0; i < item.blocks; i += 1) {
        const blockMinute = item.startMinute + i * settings.slotUnitMinutes
        await prisma.slotAllocation.updateMany({
          where: {
            slotDate: dateOnly(item.date),
            activity: item.activity,
            slotStartMinute: blockMinute,
          },
          data: { used: { decrement: 1 } },
        })
      }
    }

    console.log(`  ${booking.bookingCode}  ${item.status.padEnd(20)} ${item.reference}`)
  }

  // Dock yang sedang dipakai ditandai OCCUPIED agar dashboard konsisten.
  for (const dock of docks) {
    const occupied = allRows.some(
      (b) => b.dockId === dock.id && ['DOCK_ASSIGNED', 'IN_PROGRESS'].includes(b.status)
    )
    if (occupied) {
      await prisma.dock.update({
        where: { id: dock.id },
        data: { currentStatus: 'OCCUPIED' },
      })
    }
  }

  console.log('\n[seed] selesai. Akun demo (password sama untuk semua):')
  console.log(`  Admin      admin@tsb.test      / ${PASSWORD}`)
  console.log(`  Customer   customer@tsb.test   / ${PASSWORD}`)
  console.log(`  Customer   customer2@tsb.test  / ${PASSWORD}`)
  console.log(`  Security   gate@tsb.test       / ${PASSWORD}`)
  console.log(`  Checker    checker@tsb.test    / ${PASSWORD}`)
  console.log(`\n[seed] admin id=${admin.id}`)
}

main()
  .catch((error) => {
    console.error('[seed] gagal', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
