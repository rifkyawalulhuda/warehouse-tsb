/**
 * Mencetak kartu tiket saja.
 *
 * Aturan `visibility: hidden` pada seluruh halaman sering bocor: lapisan UI
 * (devtools, toast, panel) punya gaya sendiri dan tetap tergambar. Karena itu
 * setiap saudara dari jalur kartu disembunyikan langsung lewat DOM, lalu
 * dikembalikan setelah dialog cetak ditutup.
 *
 * Atribut penanda dipakai, bukan kelas Tailwind, supaya aturan cetak di
 * `ticket-print.css` tidak bergantung pada gaya halaman.
 */
const HIDDEN_ATTR = 'data-print-hidden'

let restore: (() => void) | null = null

export function hideForPrint(card: Element) {
  restoreAfterPrint()

  const hidden: HTMLElement[] = []
  let node: Element | null = card

  while (node && node.parentElement && node !== document.body) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.contains(card)) continue
      if (!(sibling instanceof HTMLElement)) continue
      if (sibling.hasAttribute(HIDDEN_ATTR)) continue
      sibling.setAttribute(HIDDEN_ATTR, '')
      hidden.push(sibling)
    }
    node = node.parentElement
  }

  restore = () => {
    for (const element of hidden) element.removeAttribute(HIDDEN_ATTR)
  }
}

export function restoreAfterPrint() {
  restore?.()
  restore = null
}
