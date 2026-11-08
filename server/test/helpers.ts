import type { Express } from 'express'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import type { PrismaClient, ActivityType, Role } from '@prisma/client'
export const TEST_PASSWORD = 'Rahasia123'

let cachedHash: string | null = null

export async function passwordHash(): Promise<string> {
  cachedHash ??= await bcrypt.hash(TEST_PASSWORD, 4)
  return cachedHash
}

/**
 * Membersihkan seluruh tabel. RESTART IDENTITY membuat id dock/jenis truk
 * deterministik antar tes, dan CASCADE menangani foreign key.
 */
export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      audit_logs,
      booking_time_logs,
      bookings,
      slot_allocations,
      booking_day_sequences,
      docks,
      warehouses,
      truck_types,
      users,
      warehouse_settings
    RESTART IDENTITY CASCADE
  `)
}

export type SeedOptions = {
  docks?: { dockCode: string; allowedActivity: 'LOADING' | 'UNLOADING' | 'BOTH' }[]
  truckTypes?: { truckName: string; durationMinutes: number; blocksRequired: number }[]
  operatingStartMinute?: number
  operatingEndMinute?: number
  slotUnitMinutes?: number
  gracePeriodMinutes?: number
  earlyArrivalLimitMinutes?: number
  bookingWindowDays?: number
}

export type SeededUser = { id: string; email: string; role: Role }

/**
 * Data minimum untuk menguji alur booking: satu setelan gudang, jenis truk,
 * dock, dan akun untuk tiap peran.
 */
export async function seedBase(prisma: PrismaClient, options: SeedOptions = {}) {
  await prisma.warehouseSetting.create({
    data: {
      id: 1,
      warehouseName: 'Gudang Tes',
      operatingStartMinute: options.operatingStartMinute ?? 480,
      operatingEndMinute: options.operatingEndMinute ?? 1020,
      slotUnitMinutes: options.slotUnitMinutes ?? 30,
      gracePeriodMinutes: options.gracePeriodMinutes ?? 15,
      earlyArrivalLimitMinutes: options.earlyArrivalLimitMinutes ?? 60,
      bookingWindowDays: options.bookingWindowDays ?? 7,
    },
  })

  // Satu gudang, sama seperti pengaturan — dock selalu menunjuk ke sesuatu.
  const warehouse = await prisma.warehouse.create({
    data: { name: 'Gudang Tes' },
  })

  const truckTypes = await Promise.all(
    (
      options.truckTypes ?? [
        { truckName: 'CDD Long', durationMinutes: 60, blocksRequired: 2 },
        { truckName: 'Tronton', durationMinutes: 90, blocksRequired: 3 },
      ]
    ).map((data) => prisma.truckType.create({ data }))
  )

  const docks = await Promise.all(
    (options.docks ?? [{ dockCode: 'D1', allowedActivity: 'UNLOADING' as const }]).map((data) =>
      prisma.dock.create({ data: { ...data, warehouseId: warehouse.id } })
    )
  )

  const hash = await passwordHash()
  const account = (name: string, email: string, role: Role) =>
    prisma.user.create({ data: { name, email, role, passwordHash: hash } })

  const [admin, customer, customer2, gate, checker] = await Promise.all([
    account('Admin Tes', 'admin@test.local', 'ADMIN'),
    account('Customer Satu', 'customer1@test.local', 'CUSTOMER'),
    account('Customer Dua', 'customer2@test.local', 'CUSTOMER'),
    account('Gate Tes', 'gate@test.local', 'GATE_OFFICER'),
    account('Checker Tes', 'checker@test.local', 'CHECKER'),
  ])

  return { truckTypes, docks, admin, customer, customer2, gate, checker }
}

/** Login lewat API dan kembalikan header Cookie yang bisa dipakai supertest. */
export async function loginCookie(app: Express, email: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD })

  if (response.status !== 200) {
    throw new Error(`Login ${email} gagal: ${response.status} ${JSON.stringify(response.body)}`)
  }

  const cookies = response.headers['set-cookie']
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : []
  if (list.length === 0) throw new Error(`Login ${email} tidak mengembalikan cookie`)

  return list.map((cookie) => cookie.split(';')[0]).join('; ')
}

export function activityDocks(count: number, activity: ActivityType) {
  return Array.from({ length: count }, (_, index) => ({
    dockCode: `${activity === 'LOADING' ? 'L' : 'D'}${index + 1}`,
    allowedActivity: activity,
  }))
}
