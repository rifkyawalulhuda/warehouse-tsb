/**
 * Penanda "ada persetujuan yang menunggu".
 *
 * Satu definisi untuk tiga tempat: menu sidebar, tombol menu di ponsel, dan
 * tab Persetujuan. Geraknya karena itu selalu sama di seluruh aplikasi.
 */

/**
 * Titik merah berdenyut, tanpa angka.
 *
 * Cincin luar memakai `animate-ping` (melebar lalu memudar) supaya geraknya
 * terbaca sebagai "ada yang baru masuk", bukan sekadar kedip opacity yang
 * nyaris tak terlihat pada titik 8px. `motion-reduce` mematikan cincinnya,
 * bukan titiknya — informasinya tetap ada bagi yang meminta kurangi animasi.
 */
export function ApprovalPulseDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex size-2 shrink-0 ${className ?? ''}`}
    >
      <span className='absolute inset-0 rounded-full bg-destructive/70 animate-ping motion-reduce:hidden' />
      <span className='relative inline-flex size-2 rounded-full bg-destructive' />
    </span>
  )
}

/**
 * Titik + jumlah yang menunggu.
 *
 * Angka memakai `tabular-nums` supaya lebar menu tidak bergeser saat jumlahnya
 * berubah dari 9 ke 10.
 */
export function PendingApprovalBadge({ count }: { count: number }) {
  return (
    <span className='flex shrink-0 items-center gap-1.5'>
      <ApprovalPulseDot />
      <span className='text-xs font-semibold tabular-nums text-destructive'>
        {count}
      </span>
      <span className='sr-only'>menunggu persetujuan</span>
    </span>
  )
}
