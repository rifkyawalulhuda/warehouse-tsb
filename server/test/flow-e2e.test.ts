import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { TEST_PASSWORD, loginCookie, resetDatabase, seedBase } from './helpers'

/**
 * Alur transaksi lengkap dari satu sisi ke sisi lain: Admin menyiapkan gudang,
 * Customer memesan, Admin menyetujui, Petugas Gate mencatat kedatangan, Checker
 * menugaskan dock dan menyelesaikan proses, Gate mencatat keluar, lalu Admin
 * menutup hari dengan laporan.
 *
 * Berbeda dari berkas tes lain yang menguji satu endpoint secara terpisah, tes
 * ini memakai SATU rangkaian permintaan berurutan dengan state yang dibawa dari
 * langkah ke langkah. Tujuannya menangkap bug yang hanya muncul saat peran
 * berganti — mis. status yang benar di satu layar tetapi salah di layar
 * berikutnya, atau kuota yang dilepas dua kali.
 *
 * Jam dipalsukan ke 2026-11-28 08:00 WIB supaya "hari ini", jam slot, dan
 * keterlambatan tidak bergantung pada kapan tes dijalankan.
 */
const app: Express = createApp()

const TODAY = '2026-11-28'
const TOMORROW = '2026-11-29'
const DAY_AFTER = '2026-11-30'
const CUSTOMER_PASSWORD = 'RahasiaE2E2026'
const NEW_PASSWORD = 'SI_SECRET_PASSWORD_7G4LM2PQ'
/** Kode yang tidak pernah dibuat — dipakai menguji jalur 404. */
const UNKNOWN_CODE = 'E2E-20261128-999'

let adminCookie: string
let customerCookie: string
let gateCookie: string
let checkerCookie: string

let bandungId: number
let loadingDockId: number
let fusoId: number
let processTypeId: number
let customerId: string

let mainBookingId: string
let mainBookingCode: string
let mainQrToken: string
let lateId: string
let lateCode: string

/** Setiap kegagalan menyertakan badan respons: status saja tidak cukup untuk debug. */
function expectStatus(response: request.Response, status: number) {
  expect(response.status, JSON.stringify(response.body)).toBe(status)
}

/**
 * Menukar refresh cookie menjadi access cookie baru, seperti yang dilakukan
 * klien saat menerima 401. Tes ini memajukan jam lebih dari masa berlaku access
 * token, jadi cookie hasil login di awal sudah kedaluwarsa.
 */
async function refreshCookie(cookie: string): Promise<string> {
  const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
  expectStatus(response, 200)

  const merged = new Map<string, string>()
  const put = (pair: string) => {
    const index = pair.indexOf('=')
    if (index > 0) merged.set(pair.slice(0, index), pair.slice(index + 1))
  }
  for (const pair of cookie.split(/;\s*/)) put(pair)
  for (const raw of (response.headers['set-cookie'] ?? []) as unknown as string[]) {
    // `set-cookie` membawa atribut setelah titik koma; hanya pasangan
    // nama=nilai pertama yang dipakai sebagai cookie permintaan.
    const [pair] = raw.split(';')
    if (pair) put(pair)
  }
  return [...merged].map(([name, value]) => `${name}=${value}`).join('; ')
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-28T01:00:00.000Z'))

  await resetDatabase(prisma)
  await seedBase(prisma, {
    docks: [{ dockCode: 'D1', allowedActivity: 'UNLOADING' }],
  })

  adminCookie = await loginCookie(app, 'admin@test.local')
  gateCookie = await loginCookie(app, 'gate@test.local')
  checkerCookie = await loginCookie(app, 'checker@test.local')
})

afterAll(async () => {
  vi.useRealTimers()
})

/* ================================================================== */
/* 1. Admin menyiapkan gudang                                          */
/* ================================================================== */

describe('1. Admin menyiapkan gudang', () => {
  it('membaca pengaturan awal', async () => {
    const response = await request(app).get('/api/settings').set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.warehouseName).toBe('Gudang Tes')
    expect(response.body.data.slotUnitMinutes).toBe(30)
    // Bawaan schema: tidak ada persetujuan manual.
    expect(response.body.data.approvalMode).toBe('AUTO')
  })

  it('mengubah pengaturan lewat PUT', async () => {
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', adminCookie)
      .send({
        approvalMode: 'MANUAL',
        bookingCodePrefix: 'E2E',
        ticketDesign: 'NAVY',
        footerCompany: 'PT E2E Sejahtera',
        footerLocation: 'Jakarta',
        operatingStartMinute: 480,
        operatingEndMinute: 1020,
        slotUnitMinutes: 30,
        gracePeriodMinutes: 15,
        earlyArrivalLimitMinutes: 60,
        bookingWindowDays: 7,
        approvalLeadMinutes: 15,
        approvalMinDecisionMinutes: 10,
      })
    expectStatus(response, 200)
    expect(response.body.data.approvalMode).toBe('MANUAL')
    expect(response.body.data.bookingCodePrefix).toBe('E2E')
    expect(response.body.data.ticketDesign).toBe('NAVY')
  })

  it('membagikan merek ke halaman publik', async () => {
    const response = await request(app).get('/api/branding')
    expectStatus(response, 200)
    expect(response.body.data.ticketDesign).toBe('NAVY')
    expect(response.body.data.footerCompany).toBe('PT E2E Sejahtera')
  })

  it('membuat gudang, dock, jenis truk, dan jenis proses', async () => {
    const warehouse = await request(app)
      .post('/api/master/warehouses')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Bandung' })
    expectStatus(warehouse, 201)
    bandungId = warehouse.body.data.id

    const dock = await request(app)
      .post('/api/master/docks')
      .set('Cookie', adminCookie)
      .send({
        dockCode: 'B1',
        allowedActivity: 'LOADING',
        areaName: 'Area Bandung',
        warehouseId: bandungId,
      })
    expectStatus(dock, 201)
    loadingDockId = dock.body.data.id
    expect(dock.body.data.warehouse.name).toBe('Gudang Bandung')

    // 120 menit / 30 menit per blok = 4 blok.
    const truckType = await request(app)
      .post('/api/master/truck-types')
      .set('Cookie', adminCookie)
      .send({ truckName: 'Fuso E2E', durationMinutes: 120 })
    expectStatus(truckType, 201)
    fusoId = truckType.body.data.id
    expect(truckType.body.data.blocksRequired).toBe(4)

    const processType = await request(app)
      .post('/api/master/process-types')
      .set('Cookie', adminCookie)
      .send({ name: 'Bongkar Cepat', durationMinutes: 30 })
    expectStatus(processType, 201)
    processTypeId = processType.body.data.id
  })

  it('menampilkan master data yang baru dibuat', async () => {
    const docks = await request(app).get('/api/master/docks').set('Cookie', adminCookie)
    expectStatus(docks, 200)
    expect(docks.body.data.docks.map((d: { dockCode: string }) => d.dockCode)).toEqual(
      expect.arrayContaining(['B1', 'D1'])
    )

    const truckTypes = await request(app)
      .get('/api/master/truck-types')
      .set('Cookie', adminCookie)
    expectStatus(truckTypes, 200)
    expect(truckTypes.body.data).toHaveLength(3)

    const processTypes = await request(app)
      .get('/api/master/process-types')
      .set('Cookie', adminCookie)
    expectStatus(processTypes, 200)
    expect(processTypes.body.data[0].name).toBe('Bongkar Cepat')
  })

  it('membuat customer dengan batas gudang dan akun loginnya', async () => {
    const customer = await request(app)
      .post('/api/customers')
      .set('Cookie', adminCookie)
      .send({
        name: 'PT E2E Sejahtera',
        autoApproveBooking: false,
        warehouseIds: [bandungId],
      })
    expectStatus(customer, 201)
    customerId = customer.body.data.id
    // API mengirim relasi gudang sebagai objek, bukan daftar id.
    expect(customer.body.data.warehouses).toEqual([
      { id: bandungId, name: 'Gudang Bandung' },
    ])

    const user = await request(app)
      .post(`/api/customers/${customerId}/users`)
      .set('Cookie', adminCookie)
      .send({
        name: 'Budi E2E',
        email: 'budi@e2e.local',
        password: CUSTOMER_PASSWORD,
      })
    expectStatus(user, 201)
    expect(user.body.data.email).toBe('budi@e2e.local')

    const detail = await request(app)
      .get(`/api/customers/${customerId}`)
      .set('Cookie', adminCookie)
    expectStatus(detail, 200)
    expect(detail.body.data.users).toHaveLength(1)
  })

  it('membuat petugas tambahan lalu menonaktifkannya', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Checker Malam',
        email: 'checker2@e2e.local',
        role: 'CHECKER',
        password: CUSTOMER_PASSWORD,
      })
    expectStatus(created, 201)
    expect(created.body.data.role).toBe('CHECKER')

    const patched = await request(app)
      .patch(`/api/users/${created.body.data.id}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
    expectStatus(patched, 200)
    expect(patched.body.data.isActive).toBe(false)
  })
})

/* ================================================================== */
/* 2. Customer memesan                                                 */
/* ================================================================== */

describe('2. Customer memesan', () => {
  beforeAll(async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'budi@e2e.local', password: CUSTOMER_PASSWORD })
    expectStatus(login, 200)
    const cookies = login.headers['set-cookie'] as unknown as string[]
    customerCookie = cookies.map((c) => c.split(';')[0]).join('; ')
  })

  it('melihat ketersediaan slot dengan durasi truk + proses', async () => {
    const response = await request(app)
      .get('/api/bookings/slots/availability')
      .query({
        date: TODAY,
        activity: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
      })
      .set('Cookie', customerCookie)
    expectStatus(response, 200)

    // 120 menit truk + 30 menit proses = 5 blok.
    expect(response.body.data.blocksRequired).toBe(5)

    const slot = response.body.data.slots.find(
      (s: { startMinute: number }) => s.startMinute === 540
    )
    expect(slot.status).toBe('AVAILABLE')
    expect(slot.remaining).toBe(1)
  })

  it('membuat booking untuk jam 09:00', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TODAY,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 540,
        referenceDocNo: 'DO-E2E-001',
        licensePlate: 'B 9012 E2E',
        driverName: 'Supir E2E',
        driverPhone: '081234567890',
      })
    expectStatus(response, 201)

    const booking = response.body.data
    mainBookingId = booking.id
    mainBookingCode = booking.bookingCode
    mainQrToken = booking.qrToken

    expect(mainBookingCode).toMatch(/^E2E-20261128-\d{3}$/)
    expect(booking.status).toBe('BOOKED_READY')
    expect(booking.approvalStatus).toBe('PENDING')
    expect(booking.blocksLocked).toBe(5)
    expect(booking.processName).toBe('Bongkar Cepat')
  })

  it('slot yang terpakai berubah menjadi penuh', async () => {
    const response = await request(app)
      .get('/api/bookings/slots/availability')
      .query({
        date: TODAY,
        activity: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
      })
      .set('Cookie', customerCookie)
    expectStatus(response, 200)

    const booked = response.body.data.slots.find(
      (s: { startMinute: number }) => s.startMinute === 540
    )
    expect(booked.status).toBe('FULL')
    expect(booked.remaining).toBe(0)

    // Slot setelahnya masih bebas.
    const free = response.body.data.slots.find(
      (s: { startMinute: number }) => s.startMinute === 720
    )
    expect(free.status).toBe('AVAILABLE')
  })

  it('booking muncul di daftar aktif customer', async () => {
    const response = await request(app)
      .get('/api/bookings/my-list')
      .query({ scope: 'active' })
      .set('Cookie', customerCookie)
    expectStatus(response, 200)
    expect(response.body.data.map((b: { id: string }) => b.id)).toContain(mainBookingId)
  })

  it('tiket publik bisa dibuka tanpa login', async () => {
    const response = await request(app).get(`/api/tickets/${mainQrToken}`)
    expectStatus(response, 200)
    // Endpoint tiket mengirim booking langsung sebagai `data`, bukan dibungkus.
    expect(response.body.data.bookingCode).toBe(mainBookingCode)
    expect(response.body.data.status).toBe('BOOKED_READY')
    // Supir belum tahu dock sebelum checker menugaskan.
    expect(response.body.data.dockCode).toBeNull()
  })

  it('melengkapi data kendaraan lewat tiket publik lalu membatalkan', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TODAY,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 720,
        referenceDocNo: 'DO-E2E-002',
      })
    expectStatus(created, 201)
    expect(created.body.data.status).toBe('BOOKED_INCOMPLETE')

    const secondId = created.body.data.id
    const secondToken = created.body.data.qrToken

    const filled = await request(app)
      .patch(`/api/tickets/${secondToken}/vehicle-info`)
      .send({ licensePlate: 'B 3344 E2E', driverName: 'Supir Dua' })
    expectStatus(filled, 200)
    expect(filled.body.data.status).toBe('BOOKED_READY')

    const cancelled = await request(app)
      .post(`/api/bookings/${secondId}/cancel`)
      .set('Cookie', customerCookie)
    expectStatus(cancelled, 200)
    expect(cancelled.body.data.status).toBe('CANCELLED')

    // Kuota kembali: slot 12:00 bisa dipesan lagi.
    const availability = await request(app)
      .get('/api/bookings/slots/availability')
      .query({
        date: TODAY,
        activity: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
      })
      .set('Cookie', customerCookie)
    expectStatus(availability, 200)
    const slot = availability.body.data.slots.find(
      (s: { startMinute: number }) => s.startMinute === 720
    )
    expect(slot.status).toBe('AVAILABLE')
    expect(slot.remaining).toBe(1)
  })
})

/* ================================================================== */
/* 3. Admin menyetujui                                                 */
/* ================================================================== */

describe('3. Admin menyetujui booking', () => {
  it('antrean persetujuan berisi booking customer', async () => {
    const response = await request(app)
      .get('/api/approvals')
      .query({ status: 'PENDING' })
      .set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.total).toBe(1)
    expect(response.body.data.bookings[0].id).toBe(mainBookingId)
    expect(response.body.data.bookings[0].approvalDeadline).toBeTruthy()
  })

  it('menghitung antrean tanpa mengirim daftarnya', async () => {
    const response = await request(app)
      .get('/api/approvals/count')
      .set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.pending).toBe(1)
  })

  it('gate-in ditolak selama booking belum disetujui', async () => {
    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: mainBookingCode })
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('APPROVAL_PENDING')
  })

  it('pindai kode asing dicatat sebagai penolakan', async () => {
    const response = await request(app)
      .get(`/api/ops/scan/${UNKNOWN_CODE}`)
      .query({ record: 1 })
      .set('Cookie', gateCookie)
    expectStatus(response, 404)
    expect(response.body.error.code).toBe('BOOKING_NOT_FOUND')

    const attempt = await prisma.scanAttempt.findFirst({
      where: { qrToken: UNKNOWN_CODE, reason: 'NOT_FOUND' },
      orderBy: { createdAt: 'desc' },
    })
    expect(attempt).toBeTruthy()
    expect(attempt?.userRole).toBe('GATE_OFFICER')
  })

  it('menyetujui booking', async () => {
    const response = await request(app)
      .post(`/api/approvals/${mainBookingId}/approve`)
      .set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.approvalStatus).toBe('APPROVED')
    expect(response.body.data.approvedAt).toBeTruthy()
  })

  it('antrean menjadi kosong', async () => {
    const response = await request(app)
      .get('/api/approvals/count')
      .set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.pending).toBe(0)
  })
})

/* ================================================================== */
/* 4. Petugas gate mencatat kedatangan                                 */
/* ================================================================== */

describe('4. Petugas gate', () => {
  it('pindai menampilkan tombol gate-in aktif', async () => {
    const response = await request(app)
      .get(`/api/ops/scan/${mainBookingCode}`)
      .set('Cookie', gateCookie)
    expectStatus(response, 200)
    expect(response.body.data.canGateIn).toBe(true)
    expect(response.body.data.approvalPending).toBe(false)
    expect(response.body.data.vehicleIncomplete).toBe(false)
    // Datang tepat 60 menit lebih awal: batasnya 60, jadi masih boleh.
    expect(response.body.data.earlyArrival).toBeNull()
  })

  it('mencatat gate-in tepat waktu', async () => {
    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: mainBookingCode })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('CHECKED_IN_ON_TIME')
    expect(response.body.data.lateMinutes).toBe(0)
  })

  it('gate-in kedua ditolak', async () => {
    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: mainBookingCode })
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('INVALID_TRANSITION')
  })

  it('data kendaraan terkunci setelah truk masuk gerbang', async () => {
    // Dulu rute ini memeriksa status di luar transaksi lalu menulis tanpa
    // syarat, sehingga penyimpanan yang datang di sela gate-in bisa
    // mengembalikan status menjadi BOOKED_READY.
    const response = await request(app)
      .patch(`/api/bookings/${mainBookingId}/vehicle-info`)
      .set('Cookie', customerCookie)
      .send({ licensePlate: 'B 9999 E2E' })
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('VEHICLE_LOCKED')

    const detail = await request(app)
      .get(`/api/bookings/${mainBookingId}`)
      .set('Cookie', customerCookie)
    expectStatus(detail, 200)
    expect(detail.body.data.status).toBe('CHECKED_IN_ON_TIME')
    expect(detail.body.data.licensePlate).toBe('B 9012 E2E')
  })

  it('riwayat gerbang mencatat kedatangan', async () => {
    const response = await request(app)
      .get('/api/ops/gate-history')
      .query({ from: TODAY, to: TODAY })
      .set('Cookie', gateCookie)
    expectStatus(response, 200)

    const row = response.body.data.rows.find(
      (r: { bookingCode: string; event: string }) =>
        r.bookingCode === mainBookingCode && r.event === 'GATE_IN'
    )
    expect(row).toBeTruthy()
    expect(row.minutesInside).toBeNull()
  })
})

/* ================================================================== */
/* 5. Checker gudang                                                   */
/* ================================================================== */

describe('5. Checker gudang', () => {
  it('antrean hari ini berisi truk yang sudah masuk', async () => {
    const response = await request(app)
      .get('/api/ops/queue')
      .query({ date: TODAY })
      .set('Cookie', checkerCookie)
    expectStatus(response, 200)
    const row = response.body.data.onTime.find(
      (b: { id: string }) => b.id === mainBookingId
    )
    expect(row).toBeTruthy()
    expect(row.status).toBe('CHECKED_IN_ON_TIME')
    // Izin gudang customer ikut supaya pemilih dock bisa memisahkan pilihan.
    expect(row.customer.warehouseIds).toEqual([bandungId])
  })

  it('hanya dock gudang yang diizinkan yang tersedia', async () => {
    const response = await request(app)
      .get('/api/ops/docks')
      .set('Cookie', checkerCookie)
    expectStatus(response, 200)
    const dock = response.body.data.find((d: { id: number }) => d.id === loadingDockId)
    expect(dock.currentStatus).toBe('AVAILABLE')
    expect(dock.warehouse.name).toBe('Gudang Bandung')
  })

  it('pindai versi checker menawarkan penugasan dock', async () => {
    const response = await request(app)
      .get(`/api/ops/checker/scan/${mainBookingCode}`)
      .set('Cookie', checkerCookie)
    expectStatus(response, 200)
    expect(response.body.data.booking.id).toBe(mainBookingId)
  })

  it('menugaskan dock B1', async () => {
    const response = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: mainBookingId, dockId: loadingDockId })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('DOCK_ASSIGNED')
    expect(response.body.data.assignedDock.dockCode).toBe('B1')

    const docks = await request(app).get('/api/ops/docks').set('Cookie', checkerCookie)
    const dock = docks.body.data.find((d: { id: number }) => d.id === loadingDockId)
    expect(dock.currentStatus).toBe('OCCUPIED')
  })

  it('dock yang sama tidak bisa dipakai truk lain', async () => {
    // Majukan jam ke 10:30 supaya truk berikutnya (11:30) tidak ditolak
    // EARLY_ARRIVAL — batas datang awal di pengaturan adalah 60 menit.
    vi.setSystemTime(new Date('2026-11-28T03:30:00.000Z'))
    // Access token berumur pendek; tukar dulu seperti klien setelah 401.
    adminCookie = await refreshCookie(adminCookie)
    customerCookie = await refreshCookie(customerCookie)
    gateCookie = await refreshCookie(gateCookie)
    checkerCookie = await refreshCookie(checkerCookie)

    const second = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TODAY,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 690,
        referenceDocNo: 'DO-E2E-003',
        licensePlate: 'B 5566 E2E',
        driverName: 'Supir Tiga',
      })
    expectStatus(second, 201)

    await request(app)
      .post(`/api/approvals/${second.body.data.id}/approve`)
      .set('Cookie', adminCookie)
      .expect(200)
    await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: second.body.data.bookingCode })
      .expect(200)

    const response = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: second.body.data.id, dockId: loadingDockId })
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('DOCK_OCCUPIED')

    // Booking kedua tidak boleh tertahan di status setengah jadi.
    const detail = await request(app)
      .get(`/api/bookings/${second.body.data.id}`)
      .set('Cookie', adminCookie)
    expectStatus(detail, 200)
    expect(detail.body.data.status).toBe('CHECKED_IN_ON_TIME')
    expect(detail.body.data.assignedDock).toBeNull()

    // Admin tidak bisa membatalkan booking yang truknya sudah masuk gerbang —
    // aturan yang disengaja, karena kuota hari itu sudah terpakai. Jalan
    // keluarnya adalah menandai no-show setelah truk benar-benar pergi.
    const cancel = await request(app)
      .post(`/api/bookings/${second.body.data.id}/cancel`)
      .set('Cookie', adminCookie)
    expectStatus(cancel, 409)
    expect(cancel.body.error.code).toBe('CANCEL_NOT_ALLOWED')

    const noShow = await request(app)
      .post('/api/ops/no-show')
      .set('Cookie', adminCookie)
      .send({ bookingId: second.body.data.id })
    expectStatus(noShow, 200)
    expect(noShow.body.data.status).toBe('NO_SHOW')
  })

  it('memulai proses di dock', async () => {
    const response = await request(app)
      .post('/api/ops/start-process')
      .set('Cookie', checkerCookie)
      .send({ bookingId: mainBookingId })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('IN_PROGRESS')
  })

  it('menyelesaikan proses dan membebaskan dock', async () => {
    const response = await request(app)
      .post('/api/ops/finish-process')
      .set('Cookie', checkerCookie)
      .send({ bookingId: mainBookingId })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('COMPLETED')

    const docks = await request(app).get('/api/ops/docks').set('Cookie', checkerCookie)
    const dock = docks.body.data.find((d: { id: number }) => d.id === loadingDockId)
    expect(dock.currentStatus).toBe('AVAILABLE')
  })

  it('riwayat aktivitas mencatat seluruh langkah', async () => {
    // Detail booking memuat seluruh cap waktu perpindahan status.
    const detail = await request(app)
      .get(`/api/bookings/${mainBookingId}`)
      .set('Cookie', checkerCookie)
    expectStatus(detail, 200)
    expect(detail.body.data.timeLog.gateInAt).toBeTruthy()
    expect(detail.body.data.timeLog.processStartedAt).toBeTruthy()
    expect(detail.body.data.timeLog.processCompletedAt).toBeTruthy()

    // Feed dashboard adalah audit log, bukan daftar booking.
    const feed = await request(app)
      .get('/api/ops/activity')
      .query({ limit: 50 })
      .set('Cookie', checkerCookie)
    expectStatus(feed, 200)
    const actions = feed.body.data
      .filter((row: { bookingCode: string }) => row.bookingCode === mainBookingCode)
      .map((row: { action: string }) => row.action)
    expect(actions).toEqual(
      expect.arrayContaining(['GATE_IN', 'DOCK_ASSIGNED', 'PROCESS_COMPLETED'])
    )
  })
})

/* ================================================================== */
/* 6. Gate keluar                                                      */
/* ================================================================== */

describe('6. Gate mencatat keluar', () => {
  it('gate-out mencatat keluar setelah proses selesai', async () => {
    const response = await request(app)
      .post('/api/ops/gate-out')
      .set('Cookie', gateCookie)
      .send({ qrToken: mainBookingCode })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('CHECKED_OUT')
  })

  it('tiket publik menampilkan status akhir dan dock', async () => {
    const response = await request(app).get(`/api/tickets/${mainQrToken}`)
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('CHECKED_OUT')
    expect(response.body.data.dockCode).toBe('B1')
  })

  it('booking pindah dari daftar aktif ke riwayat customer', async () => {
    const active = await request(app)
      .get('/api/bookings/my-list')
      .query({ scope: 'active' })
      .set('Cookie', customerCookie)
    expectStatus(active, 200)
    expect(active.body.data.map((b: { id: string }) => b.id)).not.toContain(
      mainBookingId
    )

    const past = await request(app)
      .get('/api/bookings/my-list')
      .query({ scope: 'past' })
      .set('Cookie', customerCookie)
    expectStatus(past, 200)
    expect(past.body.data.map((b: { id: string }) => b.id)).toContain(mainBookingId)
  })
})

/* ================================================================== */
/* 7. Admin menutup hari                                               */
/* ================================================================== */

describe('7. Admin menutup hari', () => {
  it('KPI laporan menghitung booking selesai dan batal', async () => {
    const response = await request(app)
      .get('/api/reports/kpi')
      .query({ from: TODAY, to: TODAY })
      .set('Cookie', adminCookie)
    expectStatus(response, 200)

    const kpi = response.body.data.kpi
    // Booking 1 selesai, booking 2 dibatalkan customer, booking 3 no-show
    // karena truknya sudah masuk gerbang sehingga tidak bisa dibatalkan.
    expect(kpi.totalBookings).toBe(3)
    expect(kpi.completed).toBe(1)
    expect(kpi.cancelled).toBe(1)
    expect(kpi.noShow).toBe(1)
    expect(kpi.expiredPending).toBe(0)
  })

  it('ekspor Excel tersedia dalam dua bahasa', async () => {
    for (const lang of ['id', 'en']) {
      const response = await request(app)
        .get('/api/reports/export.xlsx')
        .query({ from: TODAY, to: TODAY, lang })
        .set('Cookie', adminCookie)
        .buffer(true)
      expectStatus(response, 200)
      expect(response.headers['content-type']).toContain('spreadsheetml')
      expect(Number(response.headers['content-length'])).toBeGreaterThan(1000)
    }
  })

  it('customer hanya melihat laporannya sendiri', async () => {
    const response = await request(app)
      .get('/api/reports/my')
      .query({ from: TODAY, to: TODAY })
      .set('Cookie', customerCookie)
    expectStatus(response, 200)
    expect(response.body.data.rows).toHaveLength(3)
    expect(response.body.data.kpi.completed).toBe(1)
  })

  it('Admin menandai no-show booking yang tidak datang', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 540,
        referenceDocNo: 'DO-E2E-004',
        licensePlate: 'B 7788 E2E',
        driverName: 'Supir Empat',
      })
    expectStatus(created, 201)

    await request(app)
      .post(`/api/approvals/${created.body.data.id}/approve`)
      .set('Cookie', adminCookie)
      .expect(200)

    const response = await request(app)
      .post('/api/ops/no-show')
      .set('Cookie', adminCookie)
      .send({ bookingId: created.body.data.id })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('NO_SHOW')

    // Kuota dilepas lagi untuk tanggal besok.
    const availability = await request(app)
      .get('/api/bookings/slots/availability')
      .query({
        date: TOMORROW,
        activity: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
      })
      .set('Cookie', customerCookie)
    expectStatus(availability, 200)
    const slot = availability.body.data.slots.find(
      (s: { startMinute: number }) => s.startMinute === 540
    )
    expect(slot.status).toBe('AVAILABLE')
  })

  it('jejak audit mencatat setiap perpindahan status', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { bookingId: mainBookingId },
      select: { action: true },
      orderBy: { createdAt: 'asc' },
    })
    expect(logs.map((l) => l.action)).toEqual([
      'BOOKING_CREATED',
      'BOOKING_APPROVED',
      'GATE_IN',
      'DOCK_ASSIGNED',
      'PROCESS_STARTED',
      'PROCESS_COMPLETED',
      'GATE_OUT',
    ])
  })

  it('mencatat percobaan pindai yang ditolak', async () => {
    // `scan_attempts` tidak menyimpan bookingId — hanya token, alasan, dan
    // pelakunya. Jadi dicari lewat token yang dipindai.
    const attempts = await prisma.scanAttempt.findMany({
      where: { qrToken: UNKNOWN_CODE, reason: 'NOT_FOUND' },
    })
    expect(attempts.length).toBeGreaterThan(0)
  })
})

/* ================================================================== */
/* 8. Akun pribadi                                                     */
/* ================================================================== */

/* ================================================================== */
/* 8. Jalur tambahan: tolak, batch, batas gudang, terlambat, peran      */
/* ================================================================== */

describe('8. Jalur tambahan', () => {
  let rejectId: string
  let rejectCode: string
  let jakartaId: number
  let jakartaDockId: number

  it('Admin menolak booking dengan alasan', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 540,
        referenceDocNo: 'DO-E2E-005',
        licensePlate: 'B 9900 E2E',
        driverName: 'Supir Lima',
      })
    expectStatus(created, 201)
    rejectId = created.body.data.id
    rejectCode = created.body.data.bookingCode

    const rejected = await request(app)
      .post(`/api/approvals/${rejectId}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Dokumen belum lengkap' })
    expectStatus(rejected, 200)
    expect(rejected.body.data.approvalStatus).toBe('REJECTED')
    expect(rejected.body.data.status).toBe('CANCELLED')
    expect(rejected.body.data.rejectionReason).toBe('Dokumen belum lengkap')
  })

  it('booking yang ditolak hilang dari antrean dan tidak bisa masuk', async () => {
    const queue = await request(app)
      .get('/api/approvals')
      .query({ status: 'PENDING' })
      .set('Cookie', adminCookie)
    expectStatus(queue, 200)
    expect(queue.body.data.bookings.map((b: { id: string }) => b.id)).not.toContain(
      rejectId
    )

    // Ditolak = batal. Tiketnya tidak boleh membuka gerbang, dan menyetujui
    // ulang harus ditolak dengan alasan yang jelas, bukan diam-diam berhasil.
    const gate = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: rejectCode })
    expectStatus(gate, 409)
    expect(gate.body.error.code).toBe('INVALID_TRANSITION')

    const approve = await request(app)
      .post(`/api/approvals/${rejectId}/approve`)
      .set('Cookie', adminCookie)
    expectStatus(approve, 409)
    expect(approve.body.error.code).toBe('APPROVAL_NOT_APPLICABLE')
  })

  /**
   * Regresi: booking yang dibatalkan customer tetap ber-`approval_status =
   * PENDING` (persetujuan tidak pernah selesai). Dulu baris seperti ini
   * menumpuk di antrean Admin dan tombol Setujui selalu gagal.
   */
  it('booking batal tidak menumpuk di antrean persetujuan', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 600,
        referenceDocNo: 'DO-E2E-008',
        licensePlate: 'B 3434 E2E',
        driverName: 'Supir Delapan',
      })
    expectStatus(created, 201)

    await request(app)
      .post(`/api/bookings/${created.body.data.id}/cancel`)
      .set('Cookie', customerCookie)
      .expect(200)

    const queue = await request(app)
      .get('/api/approvals')
      .query({ status: 'PENDING' })
      .set('Cookie', adminCookie)
    expectStatus(queue, 200)
    expect(queue.body.data.bookings.map((b: { id: string }) => b.id)).not.toContain(
      created.body.data.id
    )

    const count = await request(app)
      .get('/api/approvals/count')
      .set('Cookie', adminCookie)
    expectStatus(count, 200)
    // Satu-satunya PENDING tersisa adalah booking batch di langkah berikutnya;
    // yang batal tidak boleh ikut dihitung.
    expect(count.body.data.pending).toBe(0)

    const approve = await request(app)
      .post(`/api/approvals/${created.body.data.id}/approve`)
      .set('Cookie', adminCookie)
    expectStatus(approve, 409)
    expect(approve.body.error.code).toBe('APPROVAL_NOT_APPLICABLE')

    // Hal yang sama berlaku untuk Tolak. Dulu rute ini hanya memeriksa
    // approval_status, sehingga booking yang sudah dibatalkan customer masih
    // bisa "ditolak": status akhirnya sama, tetapi alasan penolakan menimpa
    // booking yang dibatalkan atas permintaan customer sendiri.
    const reject = await request(app)
      .post(`/api/approvals/${created.body.data.id}/reject`)
      .set('Cookie', adminCookie)
      .send({ reason: 'Dokumen tidak sesuai' })
    expectStatus(reject, 409)
    expect(reject.body.error.code).toBe('APPROVAL_NOT_APPLICABLE')

    const after = await request(app)
      .get(`/api/bookings/${created.body.data.id}`)
      .set('Cookie', customerCookie)
    expectStatus(after, 200)
    expect(after.body.data.status).toBe('CANCELLED')
    expect(after.body.data.rejectionReason).toBeNull()
  })

  it('menyetujui massal melewati booking yang sudah diputuskan', async () => {
    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 780,
        referenceDocNo: 'DO-E2E-006',
        licensePlate: 'B 2323 E2E',
        driverName: 'Supir Tujuh',
      })
    expectStatus(created, 201)

    const batch = await request(app)
      .post('/api/approvals/batch-approve')
      .set('Cookie', adminCookie)
      .send({ ids: [created.body.data.id, rejectId] })
    expectStatus(batch, 200)
    expect(batch.body.data.approved).toEqual([created.body.data.id])
    expect(batch.body.data.skipped).toEqual([
      { id: rejectId, reason: 'ALREADY_DECIDED' },
    ])
  })

  it('menyiapkan gudang kedua dan booking yang akan terlambat', async () => {
    const warehouse = await request(app)
      .post('/api/master/warehouses')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Jakarta' })
    expectStatus(warehouse, 201)
    jakartaId = warehouse.body.data.id

    const dock = await request(app)
      .post('/api/master/docks')
      .set('Cookie', adminCookie)
      .send({ dockCode: 'J1', allowedActivity: 'LOADING', warehouseId: jakartaId })
    expectStatus(dock, 201)
    jakartaDockId = dock.body.data.id

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TODAY,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 690,
        referenceDocNo: 'DO-E2E-007',
        licensePlate: 'B 1212 E2E',
        driverName: 'Supir Enam',
      })
    expectStatus(created, 201)
    lateId = created.body.data.id
    lateCode = created.body.data.bookingCode

    await request(app)
      .post(`/api/approvals/${lateId}/approve`)
      .set('Cookie', adminCookie)
      .expect(200)
  })

  it('truk yang datang lewat tenggang masuk daftar tunggu', async () => {
    // Lewatkan 2,5 jam: booking 11:30 kini 90 menit terlambat, lewat tenggang 15.
    vi.setSystemTime(new Date('2026-11-28T06:00:00.000Z'))
    adminCookie = await refreshCookie(adminCookie)
    customerCookie = await refreshCookie(customerCookie)
    gateCookie = await refreshCookie(gateCookie)
    checkerCookie = await refreshCookie(checkerCookie)

    const response = await request(app)
      .post('/api/ops/gate-in')
      .set('Cookie', gateCookie)
      .send({ qrToken: lateCode })
    expectStatus(response, 200)
    expect(response.body.data.status).toBe('LATE_WAITING_LIST')
    expect(response.body.data.lateMinutes).toBe(90)
  })

  it('customer hanya boleh memakai dock gudangnya sendiri', async () => {
    const forbidden = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: lateId, dockId: jakartaDockId })
    expectStatus(forbidden, 409)
    expect(forbidden.body.error.code).toBe('DOCK_WAREHOUSE_FORBIDDEN')

    // Dock gudangnya sendiri tetap boleh, dan penolakan di atas tidak boleh
    // meninggalkan status setengah jadi.
    const allowed = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: lateId, dockId: loadingDockId })
    expectStatus(allowed, 200)
    expect(allowed.body.data.status).toBe('DOCK_ASSIGNED')
  })

  it('setiap peran berhenti di batasnya', async () => {
    const settings = await request(app)
      .put('/api/settings')
      .set('Cookie', customerCookie)
      .send({ approvalMode: 'AUTO' })
    expectStatus(settings, 403)

    const approve = await request(app)
      .post(`/api/approvals/${lateId}/approve`)
      .set('Cookie', checkerCookie)
    expectStatus(approve, 403)

    const assign = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', gateCookie)
      .send({ bookingId: lateId, dockId: loadingDockId })
    expectStatus(assign, 403)
  })

  it('pindai memakai kode booking, bukan hanya token QR', async () => {
    // Tiket yang sudah tercetak memuat kode booking. Petugas gate sering
    // mengetiknya alih-alih memindai QR, jadi jalur ini harus bekerja sama.
    const response = await request(app)
      .get(`/api/ops/scan/${lateCode}`)
      .set('Cookie', gateCookie)
    expectStatus(response, 200)
    expect(response.body.data.booking.id).toBe(lateId)
  })

  it('melepas dock mengembalikan truk ke antrean', async () => {
    const unassigned = await request(app)
      .post('/api/ops/unassign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: lateId })
    expectStatus(unassigned, 200)
    expect(unassigned.body.data.status).toBe('LATE_WAITING_LIST')
    expect(unassigned.body.data.assignedDock).toBeNull()

    const docks = await request(app)
      .get('/api/ops/docks')
      .set('Cookie', checkerCookie)
    expectStatus(docks, 200)
    const dock = docks.body.data.find(
      (item: { id: number }) => item.id === loadingDockId
    )
    expect(dock.currentStatus).toBe('AVAILABLE')
  })

  it('booking yang truknya sudah masuk tidak bisa dibatalkan', async () => {
    const response = await request(app)
      .post(`/api/bookings/${lateId}/cancel`)
      .set('Cookie', customerCookie)
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('CANCEL_NOT_ALLOWED')

    // Pembatalan yang ditolak tidak boleh mengubah status apa pun.
    const detail = await request(app)
      .get(`/api/bookings/${lateId}`)
      .set('Cookie', customerCookie)
    expectStatus(detail, 200)
    expect(detail.body.data.status).toBe('LATE_WAITING_LIST')
  })

  it('Admin mengubah data customer tanpa mengganggu bookingnya', async () => {
    const patched = await request(app)
      .patch(`/api/customers/${customerId}`)
      .set('Cookie', adminCookie)
      .send({ picName: 'Budi E2E', autoApproveBooking: true })
    expectStatus(patched, 200)
    expect(patched.body.data.picName).toBe('Budi E2E')
    expect(patched.body.data.autoApproveBooking).toBe(true)

    // Booking lama tetap memakai keputusan yang berlaku saat dibuat; yang
    // berubah hanya booking berikutnya.
    const existing = await request(app)
      .get(`/api/bookings/${lateId}`)
      .set('Cookie', customerCookie)
    expectStatus(existing, 200)
    expect(existing.body.data.approvalStatus).toBe('APPROVED')

    const created = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId: processTypeId,
        startMinute: 600,
        referenceDocNo: 'DO-E2E-009',
        licensePlate: 'B 4545 E2E',
        driverName: 'Supir Sembilan',
      })
    expectStatus(created, 201)
    // Auto-approve per customer mematikan alur persetujuan sepenuhnya, bukan
    // menandainya APPROVED: tidak ada keputusan Admin yang perlu dicatat.
    expect(created.body.data.approvalStatus).toBe('NOT_REQUIRED')
    expect(created.body.data.status).toBe('BOOKED_READY')
  })
})

/* ================================================================== */
/* 9. Pengaturan akun                                                  */
/* ================================================================== */

describe('9. Pengaturan akun', () => {
  it('membaca dan mengubah profil sendiri', async () => {
    const before = await request(app)
      .get('/api/account')
      .set('Cookie', adminCookie)
    expectStatus(before, 200)

    const patched = await request(app)
      .patch('/api/account/profile')
      .set('Cookie', adminCookie)
      .send({ name: 'Admin E2E', phone: '081200000001' })
    expectStatus(patched, 200)
    expect(patched.body.data.name).toBe('Admin E2E')
    expect(patched.body.data.phone).toBe('081200000001')
  })

  it('kata sandi lama yang salah dijawab 400, bukan 401', async () => {
    const response = await request(app)
      .patch('/api/account/password')
      .set('Cookie', adminCookie)
      .send({ currentPassword: `${TEST_PASSWORD}-salah`, newPassword: NEW_PASSWORD })
    expectStatus(response, 400)
    expect(response.body.error.code).toBe('INVALID_PASSWORD')
  })

  it('mengganti kata sandi lalu masuk dengan yang baru', async () => {
    const changed = await request(app)
      .patch('/api/account/password')
      .set('Cookie', adminCookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })
    expectStatus(changed, 200)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: NEW_PASSWORD })
    expectStatus(login, 200)

    const stale = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: TEST_PASSWORD })
    expectStatus(stale, 401)
    expect(stale.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('mencabut sesi lain setelah ganti kata sandi', async () => {
    const response = await request(app)
      .post('/api/account/sessions/revoke-others')
      .set('Cookie', adminCookie)
    expectStatus(response, 200)
    expect(response.body.data.revoked).toBeGreaterThanOrEqual(0)
  })
})

/* ================================================================== */
/* 10. Master data berubah di tengah jalan                             */
/* ================================================================== */

/**
 * Perubahan master data setelah ada booking adalah sumber bug yang paling
 * mudah lolos: booking lama menyimpan salinan durasi, sedangkan master dipakai
 * untuk booking baru. Bagian ini memastikan keduanya tidak saling
 * memengaruhi, dan bahwa penjagaan (gudang masih berisi dock, jenis proses
 * nonaktif) benar-benar menolak.
 */
describe('10. Master data berubah di tengah jalan', () => {
  it('mengganti nama gudang utama ikut mengganti nama di pengaturan', async () => {
    // Gudang pertama adalah yang namanya tercetak di tiket supir, jadi
    // keduanya disimpan di dua tempat dan harus berubah bersamaan.
    const patched = await request(app)
      .patch('/api/master/warehouses/1')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Pusat E2E' })
    expectStatus(patched, 200)

    const settings = await request(app).get('/api/settings').set('Cookie', adminCookie)
    expectStatus(settings, 200)
    expect(settings.body.data.warehouseName).toBe('Gudang Pusat E2E')

    const restored = await request(app)
      .patch('/api/master/warehouses/1')
      .set('Cookie', adminCookie)
      .send({ name: 'Gudang Tes' })
    expectStatus(restored, 200)
    const after = await request(app).get('/api/settings').set('Cookie', adminCookie)
    expect(after.body.data.warehouseName).toBe('Gudang Tes')
  })

  it('gudang yang masih punya dock tidak bisa dinonaktifkan', async () => {
    const response = await request(app)
      .patch(`/api/master/warehouses/${bandungId}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
    expectStatus(response, 409)
    expect(response.body.error.code).toBe('WAREHOUSE_IN_USE')

    // Penolakan tidak boleh menyisakan perubahan setengah jadi.
    const warehouses = await request(app)
      .get('/api/master/warehouses')
      .set('Cookie', adminCookie)
    const bandung = warehouses.body.data.find(
      (item: { id: number }) => item.id === bandungId
    )
    expect(bandung.isActive).toBe(true)
  })

  it('mengubah durasi jenis truk mengubah blok untuk booking baru saja', async () => {
    const patched = await request(app)
      .patch(`/api/master/truck-types/${fusoId}`)
      .set('Cookie', adminCookie)
      .send({ durationMinutes: 60 })
    expectStatus(patched, 200)
    // 60 menit / 30 menit per blok = 2 blok.
    expect(patched.body.data.blocksRequired).toBe(2)

    // Ketersediaan memakai total durasi (truk 60 + proses 30 = 90) → 3 blok.
    const availability = await request(app)
      .get('/api/bookings/slots/availability')
      .query({
        date: TOMORROW,
        activity: 'LOADING',
        truckTypeId: fusoId,
        processTypeId,
      })
      .set('Cookie', customerCookie)
    expectStatus(availability, 200)
    expect(availability.body.data.blocksRequired).toBe(3)

    // Booking yang sudah ada tetap memegang jumlah blok saat ia dibuat (4).
    const existing = await request(app)
      .get(`/api/bookings/${mainBookingId}`)
      .set('Cookie', customerCookie)
    expectStatus(existing, 200)
    expect(existing.body.data.blocksLocked).toBe(5)

    const restored = await request(app)
      .patch(`/api/master/truck-types/${fusoId}`)
      .set('Cookie', adminCookie)
      .send({ durationMinutes: 120 })
    expectStatus(restored, 200)
    expect(restored.body.data.blocksRequired).toBe(4)
  })

  it('jenis proses nonaktif tidak bisa dipakai, tetapi booking tanpa proses diterima', async () => {
    const deactivated = await request(app)
      .patch(`/api/master/process-types/${processTypeId}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false })
    expectStatus(deactivated, 200)

    const withInactive = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        processTypeId,
        startMinute: 780,
        referenceDocNo: 'DO-E2E-010',
        licensePlate: 'B 5151 E2E',
        driverName: 'Supir Sepuluh',
      })
    expectStatus(withInactive, 404)

    // Tidak ada satu pun jenis proses aktif → pilihan kosong diterima, supaya
    // versi baru tidak menghentikan semua pemesanan di gudang yang belum
    // mengisi Master Data.
    const withoutProcess = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: DAY_AFTER,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        startMinute: 540,
        referenceDocNo: 'DO-E2E-011',
        licensePlate: 'B 5252 E2E',
        driverName: 'Supir Sebelas',
      })
    expectStatus(withoutProcess, 201)
    expect(withoutProcess.body.data.processTypeId).toBeNull()
    expect(withoutProcess.body.data.processExtraMinutes).toBe(0)

    const reactivated = await request(app)
      .patch(`/api/master/process-types/${processTypeId}`)
      .set('Cookie', adminCookie)
      .send({ isActive: true })
    expectStatus(reactivated, 200)

    // Sekarang daftarnya tidak kosong lagi, jadi pilihan kosong ditolak.
    const missingProcess = await request(app)
      .post('/api/bookings')
      .set('Cookie', customerCookie)
      .send({
        bookingDate: TOMORROW,
        activityType: 'LOADING',
        truckTypeId: fusoId,
        startMinute: 840,
        referenceDocNo: 'DO-E2E-012',
        licensePlate: 'B 5353 E2E',
        driverName: 'Supir Dua Belas',
      })
    expectStatus(missingProcess, 400)
    expect(missingProcess.body.error.code).toBe('PROCESS_TYPE_REQUIRED')
  })

  it('antrean kerja dock hanya berisi truk yang sedang dilayani', async () => {
    const assigned = await request(app)
      .post('/api/ops/assign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: lateId, dockId: loadingDockId })
    expectStatus(assigned, 200)

    const worklist = await request(app)
      .get('/api/ops/dock-worklist')
      .set('Cookie', checkerCookie)
    expectStatus(worklist, 200)
    expect(worklist.body.data.map((item: { id: string }) => item.id)).toContain(lateId)
    // Truk yang sudah di dock tidak lagi muncul sebagai "belum tiba" di antrean
    // hari itu; keduanya membaca status yang sama.
    const queue = await request(app)
      .get('/api/ops/queue')
      .set('Cookie', checkerCookie)
      .query({ date: TODAY })
    expectStatus(queue, 200)
    expect(queue.body.data.atDock.map((item: { id: string }) => item.id)).toContain(lateId)

    const released = await request(app)
      .post('/api/ops/unassign-dock')
      .set('Cookie', checkerCookie)
      .send({ bookingId: lateId })
    expectStatus(released, 200)

    const after = await request(app)
      .get('/api/ops/dock-worklist')
      .set('Cookie', checkerCookie)
    expectStatus(after, 200)
    expect(after.body.data.map((item: { id: string }) => item.id)).not.toContain(lateId)
  })
})
