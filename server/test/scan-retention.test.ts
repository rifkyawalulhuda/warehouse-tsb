import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app'
import { prisma } from '../src/lib/prisma'
import { pruneScanAttempts } from '../src/jobs/scan-attempts'
import { loginCookie, resetDatabase, seedBase } from './helpers'

const app = createApp()

/**
 * `scan_attempts` mencatat setiap pemindaian yang ditolak petugas, jadi
 * jumlahnya tumbuh sepanjang umur gudang. Tanpa pemangkasan, tabel ini
 * akhirnya lebih besar dari seluruh data booking dan memperlambat riwayat gate.
 */
describe('retensi jejak pemindaian', () => {
  it('menghapus jejak yang lebih tua dari masa simpan', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)

    const now = new Date('2026-11-13T08:00:00.000Z')
    const attempt = (qrToken: string, createdAt: Date) => ({
      qrToken,
      reason: 'NOT_FOUND',
      message: 'Tiket tidak dikenali.',
      userRole: 'GATE_OFFICER' as const,
      createdAt,
    })

    await prisma.scanAttempt.createMany({
      data: [
        // 91 hari — lewat dari masa simpan 90 hari.
        attempt('qr-lama', new Date('2026-08-14T08:00:00.000Z')),
        // 1 hari.
        attempt('qr-baru', new Date('2026-11-12T08:00:00.000Z')),
      ],
    })

    const removed = await pruneScanAttempts(now)

    expect(removed).toBe(1)
    const left = await prisma.scanAttempt.findMany({ select: { qrToken: true } })
    expect(left.map((row) => row.qrToken)).toEqual(['qr-baru'])
  })

  it('menyisakan jejak tepat di batas masa simpan', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)

    const now = new Date('2026-11-13T08:00:00.000Z')
    await prisma.scanAttempt.create({
      data: {
        qrToken: 'qr-batas',
        reason: 'NOT_FOUND',
        message: 'Tiket tidak dikenali.',
        userRole: 'GATE_OFFICER',
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
    })

    expect(await pruneScanAttempts(now)).toBe(0)
    expect(await prisma.scanAttempt.count()).toBe(1)
  })

  it('kegagalan mencatat jejak tidak menggagalkan pemindaian', async () => {
    await resetDatabase(prisma)
    await seedBase(prisma)
    const cookie = await loginCookie(app, 'gate@test.local')

    const spy = vi
      .spyOn(prisma.scanAttempt, 'create')
      .mockRejectedValueOnce(new Error('database sibuk'))

    try {
      const response = await request(app)
        .get('/api/ops/scan/qr-yang-tidak-ada?record=1')
        .set('Cookie', cookie)

      // Jejak adalah catatan tambahan; petugas tetap harus melihat alasan
      // penolakan yang sebenarnya, bukan galat 500 dari tabel riwayat.
      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    } finally {
      spy.mockRestore()
    }
  })
})
