import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { PrismaClient } from '@prisma/client'
import { createApp } from '../src/app'
import { loginCookie, resetDatabase, seedBase, TEST_PASSWORD } from './helpers'

const prisma = new PrismaClient()
const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('manajemen pengguna', () => {
  it('menolak login untuk akun yang dinonaktifkan', async () => {
    const { customer } = await seedBase(prisma)
    await prisma.user.update({
      where: { id: customer.id },
      data: { isActive: false },
    })

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: customer.email, password: TEST_PASSWORD })

    expect(response.status).toBe(401)
    // Pesannya sengaja sama dengan password salah, agar status akun tidak bocor.
    expect(response.body.error.message).toBe('Email atau password salah')
  })

  it('menolak admin menonaktifkan akunnya sendiri', async () => {
    const { admin } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const response = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Cookie', cookie)
      .send({ isActive: false })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('CANNOT_DEACTIVATE_SELF')

    const still = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })
    expect(still.isActive).toBe(true)
  })

  it('menolak menonaktifkan Admin aktif terakhir', async () => {
    const { admin, customer } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    // Admin menonaktifkan Admin lain, tetapi hanya tersisa satu Admin aktif
    // (dirinya) — jadi menonaktifkan dirinya sendiri tetap ditolak lebih dulu.
    const response = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Cookie', cookie)
      .send({ isActive: false })
    expect(response.status).toBe(400)

    // Non-admin tetap boleh dinonaktifkan.
    const ok = await request(app)
      .patch(`/api/users/${customer.id}`)
      .set('Cookie', cookie)
      .send({ isActive: false })
    expect(ok.status).toBe(200)
    expect(ok.body.data.isActive).toBe(false)
  })

  it('tetap mengizinkan admin mengaktifkan kembali akun lain', async () => {
    const { admin, customer } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)
    await prisma.user.update({ where: { id: customer.id }, data: { isActive: false } })

    const response = await request(app)
      .patch(`/api/users/${customer.id}`)
      .set('Cookie', cookie)
      .send({ isActive: true })

    expect(response.status).toBe(200)
    expect(response.body.data.isActive).toBe(true)
  })
})
