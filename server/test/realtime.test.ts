import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as ioClient, type Socket } from 'socket.io-client'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { closeRealtime, emitBookingUpdated, initRealtime } from '../src/realtime'
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

/** Tunggu event pertama yang cocok, atau gagal setelah batas waktu. */
function waitFor(socket: Socket, event: string, timeoutMs = 3000): Promise<unknown> {
  // `connect` bisa sudah terjadi sebelum listener terpasang.
  if (event === 'connect' && socket.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout menunggu ${event}`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

/** Tunggu sebentar untuk memastikan TIDAK ada event yang datang. */
function expectSilence(socket: Socket, event: string, windowMs = 600): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      clearTimeout(timer)
      socket.off(event, handler)
      reject(new Error(`seharusnya tidak menerima ${event}`))
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
    const { admin } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const staff = connect(cookie)
    const guest = connect()
    await Promise.all([waitFor(staff, 'connect'), waitFor(guest, 'connect')])

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-1',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-1',
        customerId: admin.id,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
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
    const { admin } = await seedBase(prisma)

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-2',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-2',
        customerId: admin.id,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
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

  it('pemilik booking menerima update meski bukan petugas', async () => {
    await resetDatabase(prisma)
    const { customer } = await seedBase(prisma)
    const cookie = await loginCookie(app, customer.email)

    const owner = connect(cookie)
    const stranger = connect(await loginCookie(app, (await prisma.user.findFirstOrThrow({ where: { role: 'CUSTOMER', id: { not: customer.id } } })).email))
    await Promise.all([waitFor(owner, 'connect'), waitFor(stranger, 'connect')])

    const booking = await prisma.booking.create({
      data: {
        bookingCode: 'RT-3',
        referenceDocNo: 'REF-TEST',
        qrToken: 'realtime-token-3',
        customerId: customer.id,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
        bookingDate: new Date('2030-01-01T00:00:00.000Z'),
        startTime: new Date('2030-01-01T02:00:00.000Z'),
        endTime: new Date('2030-01-01T03:00:00.000Z'),
        blocksLocked: 2,
        status: 'BOOKED_READY',
      },
    })

    const ownerEvent = waitFor(owner, 'booking.updated')
    const strangerSilence = expectSilence(stranger, 'booking.updated')

    emitBookingUpdated({
      bookingId: booking.id,
      qrToken: booking.qrToken,
      status: 'CHECKED_IN_ON_TIME',
      userId: customer.id,
    })

    await expect(ownerEvent).resolves.toMatchObject({ bookingId: booking.id })
    await strangerSilence

    owner.close()
    stranger.close()
  })

  it('cookie kedaluwarsa tetap dikenali lewat refresh token', async () => {
    await resetDatabase(prisma)
    const { gate } = await seedBase(prisma)
    const cookie = await loginCookie(app, gate.email)

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
        customerId: gate.id,
        activityType: 'UNLOADING',
        truckTypeId: (await prisma.truckType.findFirstOrThrow()).id,
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
})

// Dipakai agar `request` tidak dianggap import tak terpakai saat tes berubah.
void request


