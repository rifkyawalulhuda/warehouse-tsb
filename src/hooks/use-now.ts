import { useEffect, useState } from 'react'

/**
 * Waktu sekarang yang diperbarui berkala.
 *
 * Dipakai label relatif ("Masuk dalam 15 menit"). Tanpa detak, label itu diam
 * di angka saat halaman dibuka dan perlahan jadi salah. 30 detik cukup rapat
 * untuk satuan menit tanpa membebani render.
 */
export function useNow(intervalMs = 30_000, enabled = true) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])

  return now
}
