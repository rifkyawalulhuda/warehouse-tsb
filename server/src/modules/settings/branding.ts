import { Router } from 'express'
import { prisma } from '../../lib/prisma'

export const brandingRouter = Router()

/**
 * Judul aplikasi untuk halaman yang dibuka sebelum masuk.
 *
 * Halaman login harus menulis "Warehouse TSB" walau belum ada sesi, jadi ia
 * butuh sumber yang tidak memerlukan autentikasi. Yang dibuka hanya tiga nama
 * merek: tidak ada satu pun data operasional di sini. Galat database tidak
 * dikembalikan sebagai kegagalan — layar masuk tidak boleh kosong hanya karena
 * pengaturan belum terbaca; UI memakai judul bawaannya.
 */
brandingRouter.get('/', async (_req, res, next) => {
  try {
    const settings = await prisma.warehouseSetting.findUnique({
      where: { id: 1 },
      select: {
        appName: true,
        appTagline: true,
        appShortName: true,
        appLogoUrl: true,
        loginDescription: true,
        loginCoverUrl: true,
        loginBrandColor: true,
      },
    })

    res.json({ data: settings ?? null })
  } catch (error) {
    next(error)
  }
})
