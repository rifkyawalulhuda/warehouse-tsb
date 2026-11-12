import { useEffect, useRef, useState } from 'react'

/**
 * Apakah tombol Caps Lock sedang menyala.
 *
 * `getModifierState` hanya bisa dibaca dari event papan ketik biasa, dan React
 * tidak meneruskannya untuk `onKeyDown` di semua jalur. Karena itu hook ini
 * memasang pendengar `keydown`/`keyup` langsung di elemen input: tanpa itu,
 * status Caps Lock hanya diperbarui saat tombol ditekan, bukan saat tombol Caps
 * Lock sendiri diaktifkan.
 *
 * Browser lama, papan ketik virtual, dan perangkat sentuh tidak melaporkan Caps
 * Lock sama sekali; nilainya lalu tetap `false`, karena peringatan yang keliru
 * lebih membingungkan daripada tidak ada peringatan.
 */
export function useCapsLock(active: boolean) {
  const [capsLock, setCapsLock] = useState(false)
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !active) return

    function update(event: KeyboardEvent) {
      setCapsLock(event.getModifierState?.('CapsLock') ?? false)
    }

    // `keyup` menangkap Caps Lock yang dilepas; `keydown` menangkap saat
    // dinyalakan. Keduanya tidak merambat ke dokumen karena dihentikan di
    // elemen ini saja.
    element.addEventListener('keydown', update)
    element.addEventListener('keyup', update)

    function clear() {
      setCapsLock(false)
    }
    // Setelah kolom ditinggalkan, peringatan tidak boleh tertinggal di layar:
    // pengguna sudah tidak mengetik password di kolom itu.
    element.addEventListener('blur', clear)

    return () => {
      element.removeEventListener('keydown', update)
      element.removeEventListener('keyup', update)
      element.removeEventListener('blur', clear)
    }
  }, [active])

  return { capsLock, inputRef: ref }
}
