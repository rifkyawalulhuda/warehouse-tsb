import { useEffect, useState } from 'react'
import { useCapsLock } from '@/lib/use-caps-lock'

/**
 * Panel diagnosis sementara untuk peringatan Caps Lock.
 *
 * Hanya ada di build pengembangan dan hanya muncul bila URL memuat
 * `?capsdiag=1`. Tujuannya memisahkan tiga hal yang tidak bisa dibedakan dari
 * layar: kode baru sudah termuat atau belum, event papan ketik sampai ke
 * halaman atau tidak, dan peringatan dirender atau tidak.
 *
 * Hapus berkas ini (dan pemakaiannya di halaman masuk) setelah penyebabnya
 * ketemu.
 */
const MARKER = 'CAPS-DIAG-1'

type LastKey = {
  type: string
  key: string
  shift: boolean
  api: boolean
  count: number
}

export function CapsDiagnostic() {
  const capsLock = useCapsLock(true)
  const [last, setLast] = useState<LastKey | null>(null)
  const [formWarning, setFormWarning] = useState<string | null>(null)

  useEffect(() => {
    let count = 0
    function track(event: KeyboardEvent) {
      count += 1
      setLast({
        type: event.type,
        key: event.key,
        shift: event.shiftKey,
        api: event.getModifierState('CapsLock'),
        count,
      })
    }
    document.addEventListener('keydown', track, true)
    document.addEventListener('keyup', track, true)

    // Peringatan yang benar-benar terlihat di formulir, bukan yang dihitung
    // panel ini sendiri.
    const poll = window.setInterval(() => {
      setFormWarning(
        document.querySelector('[role="status"]')?.textContent?.trim() ?? null
      )
    }, 150)

    return () => {
      document.removeEventListener('keydown', track, true)
      document.removeEventListener('keyup', track, true)
      window.clearInterval(poll)
    }
  }, [])

  const rows: Array<[string, string]> = [
    ['kode', MARKER],
    ['hook caps', capsLock ? 'MENYALA' : 'MATI'],
    ['event', last ? `${last.count} (${last.type})` : 'belum ada'],
    ['key', last ? JSON.stringify(last.key) : '—'],
    ['shift', last ? String(last.shift) : '—'],
    ['getModifierState', last ? String(last.api) : '—'],
    ['peringatan di form', formWarning ? 'ADA' : 'TIDAK'],
    ['browser', navigator.userAgent.slice(0, 70)],
  ]

  return (
    <div className='fixed inset-x-2 bottom-2 z-50 rounded-md bg-black/90 p-2 font-mono text-[11px] leading-snug text-white shadow-lg'>
      {rows.map(([label, value]) => (
        <div key={label} className='flex gap-2'>
          <span className='w-32 shrink-0 text-white/50'>{label}</span>
          <span className='break-all'>{value}</span>
        </div>
      ))}
    </div>
  )
}