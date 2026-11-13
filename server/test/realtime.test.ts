import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioClient, type Socket } from 'socket.io-client'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { closeRealtime, emitBookingUpdated, initRealtime, revalidateConnections, rooms } from '../src/realtime'
import { cookieNames } from '../src/lib/auth'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()
let httpServer: HttpServer
let baseUrl: string

beforeAll(async () => {
  httpServer = createServer(app)
  initRealtime(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const { port } = httpServer.address() as AddressInfo
  baseUrl = `http://localhost:${port}`
})

afterAll(async () => {
  closeRealtime()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  await prisma.$disconnect()
})

function connect(cookie?: string): Socket {
  return ioClient(baseUrl, {
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    forceNew: true,
  })
}

function waitFor(socket: Socket, event: string, windowMs = 3_000) {
  // `connect` bisa sudah terjadi sebelum listener terpasang.
  if (event === 'connect' && socket.connected) return Promise.resolve()
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`Tidak menerima ${event} dalam ${windowMs}ms`))
    }, windowMs)
    const handler = (payload: unknown) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })
}

/** Memastikan sebuah event TIDAK datang dalam jendela waktu tertentu. */
function expectSilence(socket: Socket, event: string, windowMs = 600) {
  return new Promise<void>((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer)
      socket.off(event, handler)
      reject(new Error(`Seharusnya tidak menerima ${event}`))
    }
    const timer = setTimeout(() => {
      socket.off(event, handler)
      resolve()
    }, windowMs)
    socket.on(event, handler)
  })
}

describe('realtime', () => {
  it('petugas yang login menerima booking.updated, tamu tidak', async () => {
    await resetDatabase(prisma)
    const seeded = await seedBase(prisma)

    const staff = connect(await loginCookie(app, seeded.admin.email))
    const guest = connect()
    await Promise.all([waitFor(staff, 'connect'), waitFor(guest, 'connect')])

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-1',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-1',
        customerId: seeded.customerA.id,
        createdById: seeded.customer.id,
        activityType: 'UNLOADING',
        truckTypeId: seeded.truckTypes[0]!.id,
        bookingDate: new Date('2030-01-01T00:00:00.000Z'),
        startTime: new Date('2030-01-01T02:00:00.000Z'),
        endTime: new Date('2030-01-01T03:00:00.000Z'),
        blocksLocked: 2,
        status: 'BOOKED_READY',
      },
    })

    const staffEvent = waitFor(staff, 'booking.updated')
    const guestSilence = expectSilence(guest, 'booking.updated')

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CHECKED_IN_ON_TIME',
    })

    await expect(staffEvent).resolves.toMatchObject({
      bookingId: booking.id,
      status: 'CHECKED_IN_ON_TIME',
    })
    await guestSilence

    staff.close()
    guest.close()
  })

  it('tiket supir tanpa login menerima perubahan booking-nya sendiri', async () => {
    await resetDatabase(prisma)
    const seeded = await seedBase(prisma)

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-2',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-2',
        customerId: seeded.customerA.id,
        createdById: seeded.customer.id,
        activityType: 'UNLOADING',
        truckTypeId: seeded.truckTypes[0]!.id,
        bookingDate: new Date('2030-01-01T00:00:00.000Z'),
        startTime: new Date('2030-01-01T02:00:00.000Z'),
        endTime: new Date('2030-01-01T03:00:00.000Z'),
        blocksLocked: 2,
        status: 'BOOKED_READY',
      },
    })

    const other = ioClient(baseUrl, {
      transports: ['websocket'],
      auth: { qrToken: 'token-lain' },
      forceNew: true,
    })
    const ticket = ioClient(baseUrl, {
      transports: ['websocket'],
      auth: { qrToken: booking.qrToken },
      forceNew: true,
    })

    await waitFor(ticket, 'connect')
    await waitFor(other, 'connect')

    const ticketEvent = waitFor(ticket, 'booking.updated')
    const otherSilence = expectSilence(other, 'booking.updated')

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CHECKED_IN_ON_TIME',
    })

    await expect(ticketEvent).resolves.toMatchObject({ bookingId: booking.id })
    await otherSilence

    ticket.close()
    other.close()
  })

  it('rekan seperusahaan menerima update walau bukan pembuat booking', async () => {
    await resetDatabase(prisma)
    const seeded = await seedBase(prisma)

    // Rekan satu perusahaan: akun baru di customer yang sama.
    const colleague = await prisma.user.create({
      data: {
        name: 'Rekan Seperusahaan',
        email: 'customer3@test.local',
        role: 'CUSTOMER',
        customerId: seeded.customerA.id,
        passwordHash: (await prisma.user.findUniqueOrThrow({ where: { id: seeded.customer.id } }))
          .passwordHash,
      },
    })
    expect(colleague.customerId).toBe(seeded.customerA.id)

    const owner = connect(await loginCookie(app, seeded.customer.email))
    const mate = connect(await loginCookie(app, colleague.email))
    const stranger = connect(await loginCookie(app, seeded.customer2.email))
    await Promise.all([
      waitFor(owner, 'connect'),
      waitFor(mate, 'connect'),
      waitFor(stranger, 'connect'),
    ])

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-3',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-3',
        customerId: seeded.customerA.id,
        createdById: seeded.customer.id,
        activityType: 'UNLOADING',
        truckTypeId: seeded.truckTypes[0]!.id,
        bookingDate: new Date('2030-01-01T00:00:00.000Z'),
        startTime: new Date('2030-01-01T02:00:00.000Z'),
        endTime: new Date('2030-01-01T03:00:00.000Z'),
        blocksLocked: 2,
        status: 'BOOKED_READY',
      },
    })

    const ownerEvent = waitFor(owner, 'booking.updated')
    const mateEvent = waitFor(mate, 'booking.updated')
    const strangerSilence = expectSilence(stranger, 'booking.updated')

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CHECKED_IN_ON_TIME',
      customerId: seeded.customerA.id,
      userId: seeded.customer.id,
    })

    await expect(ownerEvent).resolves.toMatchObject({ bookingId: booking.id })
    // Inilah yang berubah: sebelumnya hanya pembuat yang diberi tahu.
    await expect(mateEvent).resolves.toMatchObject({ bookingId: booking.id })
    await strangerSilence

    owner.close()
    mate.close()
    stranger.close()
  })

  it('cookie kedaluwarsa tetap dikenali lewat refresh token', async () => {
    await resetDatabase(prisma)
    const seeded = await seedBase(prisma)
    const cookie = await loginCookie(app, seeded.gate.email)

    // Buang access token, sisakan refresh token — persis kondisi setelah
    // 15 menit tanpa /auth/refresh.
    const withoutAccess = cookie
      .split('; ')
      .filter((part) => !part.startsWith(`${cookieNames.access}=`))
      .join('; ')
    expect(withoutAccess).toContain(`${cookieNames.refresh}=`)

    const socket = connect(withoutAccess)
    await waitFor(socket, 'connect')

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-4',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-4',
        customerId: seeded.customerA.id,
        createdById: seeded.customer.id,
        activityType: 'UNLOADING',
        truckTypeId: seeded.truckTypes[0]!.id,
        bookingDate: new Date('2030-01-01T00:00:00.000Z'),
        startTime: new Date('2030-01-01T02:00:00.000Z'),
        endTime: new Date('2030-01-01T03:00:00.000Z'),
        blocksLocked: 2,
        status: 'BOOKED_READY',
      },
    })

    const event = waitFor(socket, 'booking.updated')
    emitBookingUpdated({ bookingId: booking.id, qrToken: booking.qrToken, status: 'X' })
    await expect(event).resolves.toMatchObject({ bookingId: booking.id })

    socket.close()
  })

  it('memutus socket yang akunnya dinonaktifkan', async () => {
    await resetDatabase(prisma)
    const seeded = await seedBase(prisma)
    const cookie = await loginCookie(app, seeded.gate.email)

    const socket = connect(cookie)
    await waitFor(socket, 'connect')

    // Socket tidak melewati Express lagi setelah handshake, jadi status akun
    // harus diperiksa ulang; tanpa itu petugas yang dinonaktifkan tetap
    // menerima papan antrean sampai ia menutup peramban.
    await prisma.user.update({ where: { id: seeded.gate.id }, data: { isActive: false } })
    await revalidateConnections()

    await waitFor(socket, 'disconnect')
    socket.close()
  })

  it('room customer memakai id perusahaan, bukan id akun', () => {
    expect(rooms.customer('abc')).toBe('customer:abc')
    expect(rooms.user('abc')).toBe('user:abc')
  })
})

// Dipakai agar `request` tidak dianggap import tak terpakai saat tes berubah.
void request
