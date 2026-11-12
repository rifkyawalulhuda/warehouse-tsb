import { useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiErrorMessage } from '@/lib/api/client'
import { uploadLoginCover } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'
import type { FormState } from './form'
import { FieldRow } from './section-panel'

/** Warna bawaan yang ditawarkan sebagai pilihan cepat, selain pemilih bebas. */
const SWATCHES = ['#1D4ED8', '#1F3A5F', '#0F172B', '#15803D', '#B45309']

type Props = {
  coverUrl: string
  brandColor: string
  onChange: (field: keyof FormState, value: string) => void
}

/**
 * Pengaturan sisi kanan halaman masuk.
 *
 * Gambar diunggah lebih dulu ke `/api/uploads/login-cover`, lalu URL-nya yang
 * masuk ke draf form. Dengan begitu tombol Simpan seksi tetap sekedar
 * mengirim teks: kalau unggahan gagal, admin tahu saat itu juga, bukan setelah
 * menyimpan dan menemukan panelnya kosong.
 */
export function LoginPanelFields({ coverUrl, brandColor, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const url = await uploadLoginCover(file)
      onChange('loginCoverUrl', url)
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
    <>
      <FieldRow
        label='Gambar panel masuk'
        htmlFor='login-cover'
        hint='PNG atau JPG, maksimal 2 MB. Hanya tampil di layar lebar — di ponsel formulir memakai seluruh layar.'
      >
        <div className='flex flex-col gap-3'>
          <div
            className={cn(
              'flex h-24 w-full items-center justify-center overflow-hidden rounded-md border bg-muted/40 sm:w-72',
              !coverUrl && 'text-muted-foreground'
            )}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt='Pratinjau gambar panel masuk'
                className='size-full object-cover'
              />
            ) : (
              <span className='flex items-center gap-2 text-xs'>
                <ImageIcon className='size-4' aria-hidden='true' />
                Belum ada gambar
              </span>
            )}
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <input
              ref={inputRef}
              id='login-cover'
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
              {uploading ? 'Mengunggah…' : coverUrl ? 'Ganti gambar' : 'Unggah gambar'}
            </Button>
            {coverUrl && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={uploading}
                onClick={() => onChange('loginCoverUrl', '')}
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

      <FieldRow
        label='Warna aksen'
        htmlFor='login-color'
        hint='Dipakai sebagai warna dasar panel dan lapisan gelap di atas gambar. Kosongkan untuk memakai warna tema.'
      >
        <div className='flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <input
              type='color'
              aria-label='Pilih warna aksen'
              value={brandColor || '#1D4ED8'}
              onChange={(event) => onChange('loginBrandColor', event.target.value.toUpperCase())}
              className='h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1'
            />
            <Input
              id='login-color'
              value={brandColor}
              onChange={(event) => onChange('loginBrandColor', event.target.value)}
              className='w-32 font-mono uppercase'
              placeholder='#1D4ED8'
              maxLength={7}
              autoComplete='off'
            />
            {brandColor && (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => onChange('loginBrandColor', '')}
              >
                Kosongkan
              </Button>
            )}
          </div>

          {/* Pilihan cepat: warna disimpan sebagai hex, dan mengetik kode warna
              dengan angka hex bukan hal yang wajar dilakukan admin gudang. */}
          <div className='flex flex-wrap gap-2'>
            {SWATCHES.map((color) => (
              <button
                key={color}
                type='button'
                aria-label={`Pakai warna ${color}`}
                aria-pressed={brandColor.toUpperCase() === color}
                onClick={() => onChange('loginBrandColor', color)}
                className={cn(
                  'size-7 rounded-full border border-black/10 ring-offset-2 ring-offset-background',
                  brandColor.toUpperCase() === color && 'ring-2 ring-ring'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </FieldRow>
    </>
  )
}
