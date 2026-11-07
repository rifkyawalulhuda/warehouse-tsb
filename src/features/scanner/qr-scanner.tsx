import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Kamera QR dengan fallback input manual. Kamera sering diblokir browser HP
 * (izin, HTTPS, atau perangkat tanpa kamera belakang), jadi jalur manual selalu
 * tersedia dan tidak boleh disembunyikan.
 */
export function QrScanner({ onScan }: { onScan: (token: string) => void }) {
  const [cameraOn, setCameraOn] = useState(false)
  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const regionId = 'qr-reader-region'

  useEffect(() => {
    if (!cameraOn) return

    const scanner = new Html5Qrcode(regionId, { verbose: false })
    scannerRef.current = scanner
    let cancelled = false

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (cancelled) return
          cancelled = true
          setCameraOn(false)
          onScan(decoded.trim())
        },
        () => {
          /* kegagalan satu frame bukan error; abaikan */
        }
      )
      .catch((error: unknown) => {
        setCameraError(
          error instanceof Error ? error.message : 'Kamera tidak bisa dibuka'
        )
        setCameraOn(false)
      })

    return () => {
      cancelled = true
      const active = scannerRef.current
      scannerRef.current = null
      if (active && active.isScanning) {
        void active.stop().then(() => active.clear()).catch(() => undefined)
      } else {
        try {
          active?.clear()
        } catch {
          /* elemen sudah dilepas */
        }
      }
    }
  }, [cameraOn, onScan])

  return (
    <div className='space-y-3'>
      <div
        id={regionId}
        className={
          cameraOn
            ? 'mx-auto w-full max-w-sm overflow-hidden rounded-xl border'
            : 'hidden'
        }
      />

      <Button
        variant={cameraOn ? 'secondary' : 'default'}
        className='w-full'
        onClick={() => {
          setCameraError(null)
          setCameraOn((value) => !value)
        }}
      >
        {cameraOn ? <CameraOff /> : <Camera />}
        {cameraOn ? 'Matikan kamera' : 'Nyalakan kamera'}
      </Button>

      {cameraError && (
        <p className='text-center text-xs text-destructive'>
          {cameraError}. Gunakan input manual di bawah.
        </p>
      )}

      <form
        className='flex gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          const token = manual.trim()
          if (token.length >= 16) {
            setManual('')
            onScan(token)
          }
        }}
      >
        <Input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder='Tempel kode tiket atau isi manual'
          autoComplete='off'
        />
        <Button type='submit' variant='outline' disabled={manual.trim().length < 16}>
          Cek
        </Button>
      </form>
    </div>
  )
}
