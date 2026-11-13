import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { getSettings } from '../lib/settings'
import {
  uploadedFileName,
  uploadsDir,
} from '../modules/settings/uploads'

/**
 * Unggahan yang tidak pernah tersimpan tetap tinggal di disk: Admin memilih
 * gambar, melihat pratinjau, lalu menutup dialog tanpa menekan Simpan. Berkas
 * lama yang diganti lewat penyimpanan sudah dihapus saat itu juga; job ini
 * hanya menyapu sisanya.
 *
 * Tenggang 24 jam memberi ruang untuk unggahan yang masih di tengah formulir:
 * berkas baru belum dirujuk siapa pun sampai pengaturan disimpan.
 */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Menghapus berkas di folder unggahan yang tidak dirujuk pengaturan dan sudah
 * melewati tenggang. Hanya dua kolom URL yang menyimpan unggahan kita
 * (`loginCoverUrl`, `appLogoUrl`), jadi daftar rujukan selalu bisa dihitung
 * ulang dari baris pengaturan.
 */
export async function pruneOrphanUploads(now: Date = new Date()): Promise<string[]> {
  const settings = await getSettings()
  const referenced = new Set(
    [uploadedFileName(settings.loginCoverUrl), uploadedFileName(settings.appLogoUrl)].filter(
      (name): name is string => name !== null
    )
  )

  let entries
  try {
    entries = await readdir(uploadsDir(), { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  const cutoff = now.getTime() - ORPHAN_GRACE_MS
  const removed: string[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (referenced.has(entry.name)) continue

    const path = join(uploadsDir(), entry.name)
    const info = await stat(path)
    if (info.mtimeMs > cutoff) continue

    await unlink(path)
    removed.push(entry.name)
  }

  return removed
}

const INTERVAL_MS = 24 * 60 * 60 * 1000

export function startUploadPruneJob(): NodeJS.Timeout {
  const run = async () => {
    try {
      const removed = await pruneOrphanUploads()
      if (removed.length > 0) {
        // eslint-disable-next-line no-console
        console.log(`[job] ${removed.length} berkas unggahan yatim dihapus`)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[job] pembersihan berkas unggahan gagal', error)
    }
  }

  void run()
  const timer = setInterval(run, INTERVAL_MS)
  timer.unref()
  return timer
}
