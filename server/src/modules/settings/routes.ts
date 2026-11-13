import { Router } from 'express'
import { prisma, type Tx } from '../../lib/prisma'
import { parse } from '../../lib/validate'
import { requireAuth, requireExactRole } from '../../middleware/auth'
import { getSettings } from '../../lib/settings'
import { badRequest, conflict } from '../../lib/http-error'
import { writeAudit } from '../../lib/audit'
import { settingsPayload } from './payload'
import { updateSchema } from './schema'
import { removeUploadedFile } from './uploads'

export const settingsRouter = Router()

/**
 * `warehouse_name` di pengaturan dan nama gudang pertama di tabel `warehouses`
 * adalah fakta yang sama — yang satu tercetak di tiket supir, yang lain yang
 * dipilih di Master Data Dock. Disinkronkan dua arah supaya tidak pernah ada
 * dua nama berbeda untuk gudang yang sama.
 */
const DEFAULT_WAREHOUSE_ID = 1

/**
 * String kosong dari formulir berarti "tidak ada", bukan nilai kosong.
 *
 * `undefined` tetap `undefined` supaya Prisma tidak menimpa kolom yang tidak
 * dikirim klien.
 */
function emptyToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

settingsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    // Customer hanya menerima bagian yang dipakai layarnya untuk memesan.
    // Angka kapasitas gudang tetap milik staf, sesuai aturan yang juga
    // diterapkan pada laporan customer.
    res.json({
      data: await settingsPayload({ includeInternal: req.user!.role !== 'CUSTOMER' }),
    })
  } catch (error) {
    next(error)
  }
})

settingsRouter.put('/', requireAuth, requireExactRole('ADMIN'), async (req, res, next) => {
  try {
    const body = parse(updateSchema, req.body, 'Pengaturan')
    const current = await getSettings()

    const startMinute = body.operatingStartMinute ?? current.operatingStartMinute
    const endMinute = body.operatingEndMinute ?? current.operatingEndMinute
    const unit = body.slotUnitMinutes ?? current.slotUnitMinutes

    if (endMinute <= startMinute) {
      throw badRequest('INVALID_WINDOW', 'Jam tutup harus setelah jam buka')
    }
    if ((endMinute - startMinute) % unit !== 0) {
      throw badRequest(
        'INVALID_WINDOW',
        'Rentang jam operasional harus kelipatan satuan blok'
      )
    }

    if (body.warehouseName !== undefined) {
      const taken = await prisma.warehouse.findFirst({
        where: { name: body.warehouseName, id: { not: DEFAULT_WAREHOUSE_ID } },
      })
      if (taken) throw conflict('WAREHOUSE_NAME_TAKEN', 'Nama gudang sudah dipakai')
    }

    // Dalam satu transaksi: kalau penamaan gudang gagal, pengaturan tidak
    // boleh ikut berubah supaya kedua tempat tidak berakhir beda nama.
    await prisma.$transaction(async (tx) => {
      const data = { ...body }
      // Isian kosong berarti "pakai bawaan" untuk nama pendek, gambar, dan
      // warna. Dikerjakan di satu tempat supaya bidang baru tidak lupa ikut.
      data.appShortName = emptyToNull(data.appShortName)
      data.loginCoverUrl = emptyToNull(data.loginCoverUrl)
      data.loginBrandColor = emptyToNull(data.loginBrandColor)
      data.appLogoUrl = emptyToNull(data.appLogoUrl)
      data.loginDescription = emptyToNull(data.loginDescription)

      await tx.warehouseSetting.update({ where: { id: current.id }, data })
      if (body.warehouseName !== undefined) {
        await tx.warehouse.updateMany({
          where: { id: DEFAULT_WAREHOUSE_ID },
          data: { name: body.warehouseName },
        })
      }

      // Perubahan mode approval mengubah siapa yang boleh booking tanpa antre.
      // Ini keputusan bisnis kritis: tanpa audit, tidak ada jawaban saat ditanya
      // "siapa yang mematikan auto-approve kemarin?". Lihat rencana §4.13.
      if (body.approvalMode !== undefined && body.approvalMode !== current.approvalMode) {
        await writeAudit(
          {
            userId: req.user!.id,
            userRole: req.user!.role,
            action: 'APPROVAL_MODE_CHANGED',
            meta: { from: current.approvalMode, to: body.approvalMode },
          },
          tx as Tx
        )
      }
    })

    // Berkas lama tidak mungkin dirujuk lagi setelah pengaturan menunjuk URL
    // lain. Dibandingkan dengan nilai yang benar-benar tersimpan, bukan dengan
    // body: isian kosong berarti "pakai bawaan", dan itu juga melepas berkas.
    const saved = await getSettings()
    for (const [before, after] of [
      [current.loginCoverUrl, saved.loginCoverUrl],
      [current.appLogoUrl, saved.appLogoUrl],
    ] as const) {
      if (before === after) continue
      try {
        await removeUploadedFile(before)
      } catch (error) {
        // Gagal menghapus berkas lama tidak boleh menggagalkan penyimpanan;
        // job pembersih harian akan menyapunya.
        // eslint-disable-next-line no-console
        console.error('[settings] gagal menghapus berkas unggahan lama', error)
      }
    }

    res.json({ data: await settingsPayload() })
  } catch (error) {
    next(error)
  }
})
