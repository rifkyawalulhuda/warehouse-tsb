import { describe, expect, it } from 'vitest'
import { hideForPrint, restoreAfterPrint } from './ticket-print'

function page() {
  document.body.innerHTML = `
    <div id="root">
      <header><h1>Status tiket</h1></header>
      <main>
        <div class="card-wrap"><article data-ticket-card><span>QR</span></article></div>
        <div class="actions"><button>Unduh</button></div>
      </main>
      <aside class="devtools">panel</aside>
    </div>`
  return document.querySelector('[data-ticket-card]')!
}

const hidden = (selector: string) =>
  document.querySelector(selector)!.hasAttribute('data-print-hidden')

describe('cetak kartu tiket', () => {
  it('menyembunyikan halaman di sekitar kartu, bukan kartunya', () => {
    const card = page()

    hideForPrint(card)

    expect(hidden('header')).toBe(true)
    expect(hidden('.actions')).toBe(true)
    expect(hidden('aside')).toBe(true)
    expect(hidden('.card-wrap')).toBe(false)
    expect(hidden('[data-ticket-card]')).toBe(false)
    expect(card.getAttribute('data-print-hidden')).toBeNull()

    restoreAfterPrint()
  })

  it('mengembalikan halaman setelah dialog cetak ditutup', () => {
    hideForPrint(page())
    restoreAfterPrint()

    for (const selector of ['header', '.actions', 'aside']) {
      expect(hidden(selector)).toBe(false)
    }
  })

  it('tidak menumpuk penanda saat dicetak dua kali', () => {
    const card = page()
    hideForPrint(card)
    hideForPrint(card)
    restoreAfterPrint()

    expect(hidden('header')).toBe(false)
  })
})
