import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { uploadsDir } from '../src/modules/settings/uploads'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await prisma.$disconnect()
})

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

describe('galat permintaan', () => {
  it('menjawab JSON rusak sebagai 400, bukan 500', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "bukan-json"')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })

  it('menolak gambar tepat di atas 2 MB dengan pesan ukuran', async () => {
    const admin = await loginCookie(app, 'admin@test.local')
    const tooLarge = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])

    const response = await request(app)
      .put('/api/uploads/logo')
      .set('Cookie', admin)
      .set('Content-Type', 'image/png')
      .send(tooLarge)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('UPLOAD_TOO_LARGE')
  })

  it('menyimpan gambar yang sah dan menolak isi yang bukan gambar', async () => {
    const admin = await loginCookie(app, 'admin@test.local')

    const accepted = await request(app)
      .put('/api/uploads/logo')
      .set('Cookie', admin)
      .set('Content-Type', 'image/png')
      .send(PNG)

    expect(accepted.status).toBe(200)
    const url = accepted.body.data.url as string
    expect(url).toMatch(/^\/api\/uploads\/app-logo-\d+-[0-9a-f]{8}\.png$/)

    const printed = await request(app)
      .put('/api/uploads/logo')
      .set('Cookie', admin)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<svg onload="alert(1)"></svg>'))

    expect(printed.status).toBe(400)
    expect(printed.body.error.code).toBe('UPLOAD_TYPE')

    await unlink(join(uploadsDir(), url.split('/').pop()!))
  })
})

describe('galat tak terduga', () => {
  it('tidak menyamarkan gangguan database sebagai sesi berakhir', async () => {
    const cookie = await loginCookie(app, 'admin@test.local')
    vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(new Error('database mati'))

    const response = await request(app).get('/api/auth/me').set('Cookie', cookie)

    expect(response.status).toBe(500)
    expect(response.body.error.code).toBe('INTERNAL_ERROR')
  })
})
