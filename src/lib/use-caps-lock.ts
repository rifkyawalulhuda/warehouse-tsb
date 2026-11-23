import { useEffect, useState } from 'react'

/**
 * Membaca keadaan Caps Lock dari satu event papan ketik.
 *
 * `getModifierState('CapsLock')` tidak bisa dipercaya sendirian: Firefox dan
 * Chromium di sebagian sistem mengembalikan `false` untuk event yang berasal
 * dari dalam kolom isian — tepat di tempat peringatan ini paling dibutuhkan.
 * Karena itu huruf yang benar-benar keluar dipakai sebagai bukti utama: huruf
 * besar tanpa Shift, atau huruf kecil dengan Shift, hanya mungkin terjadi kalau
 * Caps Lock menyala. API browser hanya dipakai untuk tombol selain huruf, dan
 * hanya saat ia menyatakan menyala; peringatan tidak pernah dinyalakan oleh
 * tebakan.
 */
function capsLockFrom(event: KeyboardEvent): boolean | null {
  if (/^[a-z]$/.test(event.key)) return event.shiftKey
  if (/^[A-Z]$/.test(event.key)) return !event.shiftKey
  return event.getModifierState?.('CapsLock') ? true : null
}

/**
 * Apakah tombol Caps Lock sedang menyala.
 *
 * Pendengar dipasang di `document`, bukan di elemen input: di halaman masuk
 * pengguna sering menyalakan Caps Lock lalu mengetik email lebih dulu, dan
 * peringatan baru muncul setelah huruf pertama masuk ke kolom password.
 *
 * Tombol Caps Lock sendiri dibalik statusnya setiap kali dilepas. Satu tekanan
 * mengirim `keydown` lalu `keyup`, jadi hanya `keyup` yang dipakai supaya
 * status tidak terbalik dua kali; keadaan lamanya dilaporkan browser pada
 * event tombol itu, sehingga API tidak bisa dipakai di sini.
 *
 * Status tidak dibersihkan saat kolom ditinggalkan — Caps Lock masih menyala
 * walau fokus pindah, dan peringatan yang tetap terlihat sesuai kenyataan.
 * Papan ketik virtual dan perangkat sentuh tidak mengirim tombol Caps Lock
 * sama sekali; nilainya lalu tetap `false`, karena peringatan yang keliru lebih
 * membingungkan daripada tidak ada peringatan.
 */
export function useCapsLock(active: boolean) {
  const [capsLock, setCapsLock] = useState(false)

  useEffect(() => {
    if (!active) return

    function update(event: KeyboardEvent) {
      if (event.key === 'CapsLock') {
        if (event.type === 'keyup') setCapsLock((prev) => !prev)
        return
      }

      const next = capsLockFrom(event)
      if (next !== null) setCapsLock(next)
    }

    // Fase tangkap dipakai agar peringatan tetap terbaca walau ada komponen
    // lain yang menghentikan penyebaran event di tengah jalan.
    document.addEventListener('keydown', update, true)
    document.addEventListener('keyup', update, true)

    return () => {
      document.removeEventListener('keydown', update, true)
      document.removeEventListener('keyup', update, true)
    }
  }, [active])

  // Saat kolom dinonaktifkan, peringatan tidak boleh tertinggal walau status
  // terakhir masih menyala.
  return active ? capsLock : false
}
