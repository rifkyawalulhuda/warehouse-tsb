import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

let seed: Awaited<ReturnType<typeof seedBase>>

beforeEach(async () => {
  await resetDatabase(prisma)
  seed = await seedBase(prisma)
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Cookie refresh dari respons /login atau /refresh, siap dikirim ulang. */
function refreshCookie(response: request.Response): string {
  const cookies = response.headers['set-cookie']
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : []
  const refresh = list.find((cookie) => cookie.startsWith('tsb_rt='))
  if (!refresh) throw new Error('Respons tidak mengirim cookie refresh')
  return refresh.split(';')[0]!
}

async function login(email: string) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Rahasia123' })
  expect(response.status).toBe(200)
  return refreshCookie(response)
}

describe('sesi login', () => {
  it('memperbarui sesi dengan cookie refresh', async () => {
    const cookie = await login('customer1@test.local')

    const response = await request(app).post('/api/auth/refresh').set('Cookie', cookie)

    expect(response.status).toBe(200)
    expect(response.body.data.email).toBe('customer1@test.local')
  })

  it('mengakhiri sesi saat logout', async () => {
    const cookie = await login('customer1@test.local')

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logout.status).toBe(200)

    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refresh.status).toBe(401)
  })

  it('memutus sesi lama saat kata sandi diganti admin', async () => {
    const cookie = await login('gate@test.local')
    const admin = await loginCookie(app, 'admin@test.local')

    const change = await request(app)
      .patch(`/api/users/${seed.gate.id}`)
      .set('Cookie', admin)
      .send({ password: 'SandiBaru123' })
    expect(change.status).toBe(200)

    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refresh.status).toBe(401)
  })

  it('memutus sesi saat akun dinonaktifkan', async () => {
    const cookie = await login('gate@test.local')
    const admin = await loginCookie(app, 'admin@test.local')

    const deactivate = await request(app)
      .patch(`/api/users/${seed.gate.id}`)
      .set('Cookie', admin)
      .send({ isActive: false })
    expect(deactivate.status).toBe(200)

    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refresh.status).toBe(401)
  })

  it('mengizinkan refresh berulang dari beberapa tab', async () => {
    const cookie = await login('customer1@test.local')

    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(first.status).toBe(200)

    const second = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie(first))

    expect(second.status).toBe(200)
  })

  it('membatasi percobaan login yang gagal', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'target@test.local', password: 'tebakan-salah' })

    for (let index = 0; index < 10; index += 1) {
      expect((await attempt()).status).toBe(401)
    }

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS')
  })
})
