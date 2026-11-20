import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { parseScanInput } from './scan-input'

/**
 * Kamera QR dengan fallback input manual. Kamera sering diblokir browser HP
 * (izin, HTTPS, atau perangkat tanpa kamera belakang), jadi jalur manual selalu
 * tersedia dan tidak boleh disembunyikan.
 */
export function QrScanner({ onScan }: { onScan: (token: string) => void }) {
  const t = useT()
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
          error instanceof Error ? error.message : ''
        )
        setCameraOn(false)
      })

    return () => {
      cancelled = true
      const active = scannerRef.current
      scannerRef.current = null
      if (active && active.isScanning) {
        void active
          .stop()
          .then(() => active.clear())
          .catch(() => undefined)
      } else {
        try {
          active?.clear()
        } catch {
          /* elemen sudah dilepas */
        }
      }
    }
  }, [cameraOn, onScan])

  const parsed = parseScanInput(manual)

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
        {cameraOn ? t('ops.scanCameraOff') : t('ops.scanCameraOn')}
      </Button>

      {cameraError !== null && (
        <p className='text-center text-xs text-destructive'>
          {t('ops.scanCameraFallback', {
            error: cameraError || t('ops.scanCameraError'),
          })}
        </p>
      )}

      <form
        className='flex gap-2'
        onSubmit={(event) => {
          event.preventDefault()
          if (!parsed) return
          setManual('')
          onScan(parsed.value)
        }}
      >
        <Input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          placeholder={t('ops.scanInputPlaceholder')}
          autoComplete='off'
          spellCheck={false}
          className='font-mono'
        />
        <Button type='submit' variant='outline' disabled={!parsed}>
          {t('ops.scanCheck')}
        </Button>
      </form>

      {manual.trim() && !parsed ? (
        <p className='text-center text-xs text-destructive'>
          {t('ops.scanInvalid')}
        </p>
      ) : (
        <p className='text-center text-xs text-muted-foreground'>
          {t('ops.scanManualHint')}
        </p>
      )}
    </div>
  )
}
