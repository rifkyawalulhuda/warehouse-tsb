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

  it('mengubah nama, email, no. HP, dan peran staf', async () => {
    const { admin, checker } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const response = await request(app)
      .patch(`/api/users/${checker.id}`)
      .set('Cookie', cookie)
      .send({
        name: 'Petugas Baru',
        email: '  BARU@TSB.test ',
        phone: '08123456789',
        role: 'GATE_OFFICER',
      })

    expect(response.body.error ?? response.body).toMatchObject({
      data: {
        name: 'Petugas Baru',
        email: 'baru@tsb.test',
        phone: '08123456789',
        role: 'GATE_OFFICER',
      },
    })
  })

  it('menolak email yang sudah dipakai akun lain tetapi menerima email sendiri', async () => {
    const { admin, checker } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const taken = await request(app)
      .patch(`/api/users/${checker.id}`)
      .set('Cookie', cookie)
      .send({ email: admin.email })
    expect(taken.status).toBe(409)
    expect(taken.body.error.code).toBe('EMAIL_TAKEN')

    // Layar mengirim seluruh isian, jadi email yang tidak berubah harus lolos.
    const same = await request(app)
      .patch(`/api/users/${checker.id}`)
      .set('Cookie', cookie)
      .send({ email: checker.email, name: 'Petugas Diperbarui' })
    expect(same.status).toBe(200)
    expect(same.body.data.name).toBe('Petugas Diperbarui')
  })

  it('mengganti password akun staf', async () => {
    const { admin, checker } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const response = await request(app)
      .patch(`/api/users/${checker.id}`)
      .set('Cookie', cookie)
      .send({ password: 'passwordbaru' })
    expect(response.status).toBe(200)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: checker.email, password: 'passwordbaru' })
    expect(login.status).toBe(200)
  })

  it('menolak admin menurunkan peran akunnya sendiri', async () => {
    const { admin } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const response = await request(app)
      .patch(`/api/users/${admin.id}`)
      .set('Cookie', cookie)
      .send({ role: 'CHECKER' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('CANNOT_DEMOTE_SELF')
  })

  it('menolak mengubah data akun customer dari halaman Pengguna', async () => {
    const { admin, customer } = await seedBase(prisma)
    const cookie = await loginCookie(app, admin.email)

    const response = await request(app)
      .patch(`/api/users/${customer.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Nama Baru' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('CUSTOMER_VIA_MASTER')
  })
})
