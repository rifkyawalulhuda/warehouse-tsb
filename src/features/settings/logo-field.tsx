import { useRef, useState } from 'react'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/lib/api/client'
import { uploadAppLogo } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'
import type { FormState } from './form'
import { FieldRow } from './section-panel'

type Props = {
  logoUrl: string
  appName: string
  onChange: (field: keyof FormState, value: string) => void
}

/**
 * Unggahan logo aplikasi.
 *
 * Sama seperti gambar panel: berkas diunggah lebih dulu, lalu URL-nya masuk ke
 * draf form, sehingga tombol Simpan seksi tetap hanya mengirim teks. Kalau
 * unggahan gagal, admin tahu saat itu juga.
 *
 * Pratinjau ditampilkan pada dua ukuran yang benar-benar dipakai — kepala
 * sidebar 28 px dan lencana halaman masuk 44 px — karena logo yang terbaca di
 * 200 px bisa berubah jadi gumpalan di 28 px.
 */
export function LogoField({ logoUrl, appName, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const url = await uploadAppLogo(file)
      onChange('appLogoUrl', url)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      setUploading(false)
      // Mengosongkan nilai input membuat berkas yang sama bisa dipilih ulang
      // setelah unggahan gagal.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <FieldRow
      label='Logo aplikasi'
      htmlFor='app-logo'
      hint='PNG atau JPG, maksimal 2 MB. Latar transparan paling aman. Kosongkan untuk memakai huruf pertama judul.'
    >
      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-end gap-5'>
          <div className='flex flex-col items-center gap-1.5'>
            <div
              className={cn(
                'flex h-16 min-w-16 items-center justify-center rounded-xl border border-dashed bg-muted/30 px-3',
                !logoUrl && 'text-muted-foreground'
              )}
            >
              <BrandLogo name={appName} logoUrl={logoUrl || null} size={40} />
            </div>
            <span className='text-[11px] text-muted-foreground'>Sidebar</span>
          </div>

          <div className='flex flex-col items-center gap-1.5'>
            <div className='flex h-16 items-center justify-center rounded-xl border border-dashed bg-muted/30 px-3'>
              <BrandLogo name={appName} logoUrl={logoUrl || null} size={16} />
            </div>
            <span className='text-[11px] text-muted-foreground'>Ikon tab</span>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <input
            ref={inputRef}
            id='app-logo'
            type='file'
            accept='image/png,image/jpeg'
            className='sr-only'
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className='size-4 animate-spin' aria-hidden='true' />
            ) : (
              <Upload className='size-4' aria-hidden='true' />
            )}
            {uploading ? 'Mengunggah…' : logoUrl ? 'Ganti logo' : 'Unggah logo'}
          </Button>
          {logoUrl && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={uploading}
              onClick={() => onChange('appLogoUrl', '')}
            >
              <Trash2 className='size-4' aria-hidden='true' />
              Hapus
            </Button>
          )}
        </div>

        {error && (
          <p role='alert' className='text-xs text-destructive'>
            {error}
          </p>
        )}
      </div>
    </FieldRow>
  )
}
