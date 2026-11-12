import * as React from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCapsLock } from '@/lib/use-caps-lock'
import { Button } from './ui/button'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
}

/**
 * Kolom password dengan tombol tampilkan/sembunyikan.
 *
 * Peringatan Caps Lock sengaja diletakkan di bawah kolom, bukan di dalamnya:
 * teks di dalam kolom akan menutupi isi password yang panjang, dan peringatan
 * ini harus bisa dibaca pembaca layar tanpa menggeser fokus.
 */
export function PasswordInput({
  className,
  disabled,
  ref,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)
  const { capsLock, inputRef } = useCapsLock(!disabled)

  // ref dari pemanggil (react-hook-form) dan ref milik hook dipakai bersamaan:
  // yang pertama untuk validasi, yang kedua untuk mendengar papan ketik.
  const setRefs = React.useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    },
    [ref, inputRef]
  )

  return (
    <div className='grid gap-1.5'>
      <div className={cn('relative rounded-md', className)}>
        <input
          type={showPassword ? 'text' : 'password'}
          ref={setRefs}
          disabled={disabled}
          aria-describedby={capsLock ? 'password-caps-lock' : undefined}
          className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
          {...props}
        />
        <Button
          type='button'
          size='icon'
          variant='ghost'
          disabled={disabled}
          className='absolute inset-e-1 top-1/2 h-6 w-6 -translate-y-1/2 rounded-md text-muted-foreground'
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
          <span className='sr-only'>
            {showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          </span>
        </Button>
      </div>
      {capsLock && (
        <p
          id='password-caps-lock'
          role='status'
          className='flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500'
        >
          <TriangleAlert className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
          Caps Lock menyala — password jadi huruf besar.
        </p>
      )}
    </div>
  )
}
