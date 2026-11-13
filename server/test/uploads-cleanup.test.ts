import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdir, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { UPLOAD_PATH, removeUploadedFile, uploadsDir } from '../src/modules/settings/uploads'
import { pruneOrphanUploads } from '../src/jobs/uploads'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

beforeEach(async () => {
  await resetDatabase(prisma)
  await seedBase(prisma)
  await mkdir(uploadsDir(), { recursive: true })
})

afterAll(async () => {
  await prisma.$disconnect()
})

/** Berkas unggahan dibuat nyata di disk: yang diuji adalah jejaknya, bukan nama URL. */
async function writeUpload(name: string, ageHours = 0): Promise<string> {
  const path = join(uploadsDir(), name)
  await writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  if (ageHours > 0) {
    const when = new Date(Date.now() - ageHours * 60 * 60 * 1000)
    await utimes(path, when, when)
  }
  return path
}

function url(name: string) {
  return `${UPLOAD_PATH}/${name}`
}

describe('pembersihan berkas unggahan', () => {
  it('menghapus berkas lama saat pengaturan mengganti gambar panel', async () => {
    const oldFile = await writeUpload('login-cover-lama.png')
    const newFile = await writeUpload('login-cover-baru.png')

    await prisma.warehouseSetting.update({
      where: { id: 1 },
      data: { loginCoverUrl: url('login-cover-lama.png') },
    })

    const cookie = await loginCookie(app, 'admin@test.local')
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ loginCoverUrl: url('login-cover-baru.png') })

    expect(response.status).toBe(200)
    expect(response.body.data.loginCoverUrl).toBe(url('login-cover-baru.png'))

    expect(existsSync(oldFile)).toBe(false)
    expect(existsSync(newFile)).toBe(true)
  })

  it('menghapus berkas lama juga saat gambar dilepas ke bawaan', async () => {
    const oldFile = await writeUpload('app-logo-lama.png')

    await prisma.warehouseSetting.update({
      where: { id: 1 },
      data: { appLogoUrl: url('app-logo-lama.png') },
    })

    const cookie = await loginCookie(app, 'admin@test.local')
    const response = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ appLogoUrl: null })

    expect(response.status).toBe(200)
    expect(existsSync(oldFile)).toBe(false)
  })

  it('tidak menghapus berkas yang masih dipakai job pembersih', async () => {
    const used = await writeUpload('login-cover-dipakai.png', 72)
    const orphan = await writeUpload('login-cover-yatim.png', 72)
    const fresh = await writeUpload('login-cover-baru.png', 1)

    await prisma.warehouseSetting.update({
      where: { id: 1 },
      data: { loginCoverUrl: url('login-cover-dipakai.png') },
    })

    const removed = await pruneOrphanUploads()

    expect(removed).toContain('login-cover-yatim.png')
    expect(removed).not.toContain('login-cover-dipakai.png')
    // Berkas yang baru diunggah tetapi belum disimpan masih diberi tenggang.
    expect(removed).not.toContain('login-cover-baru.png')
    expect(existsSync(used)).toBe(true)
    expect(existsSync(orphan)).toBe(false)
    expect(existsSync(fresh)).toBe(true)
  })

  it('menolak jalur yang keluar dari folder unggahan', async () => {
    const outside = join(uploadsDir(), '..', 'berkas-di-luar.png')
    await writeFile(outside, Buffer.from('penting'))

    expect(await removeUploadedFile(url('../berkas-di-luar.png'))).toBe(false)
    expect(await removeUploadedFile('https://contoh.test/gambar.png')).toBe(false)
    expect(existsSync(outside)).toBe(true)
  })
})
