import '@/styles/index.css'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { TicketTimeline } from './timeline'

const steps = [
  { label: 'Masuk gate', at: '2026-11-11T01:30:00.000Z' },
  { label: 'Mulai proses', at: '2026-11-11T02:00:00.000Z' },
  { label: 'Selesai proses', at: null },
  { label: 'Keluar gate', at: null },
]

describe('linimasa tiket', () => {
  it('menampilkan waktu tiap tahap yang sudah lewat', async () => {
    const screen = await render(<TicketTimeline steps={steps} />)

    // Waktu diformat dalam zona Asia/Jakarta (UTC+7). Pemisahnya bergantung
    // locale (`08.30` di id-ID, `08:30` di en-US), jadi jangan dikunci ke titik
    // dua: yang diuji adalah jamnya, bukan pemisah pilihan Intl.
    await expect.element(screen.getByText(/^08[.:]30$/)).toBeInTheDocument()
    await expect.element(screen.getByText(/^09[.:]00$/)).toBeInTheDocument()
  })

  it('menghitung kemajuan, bukan sekadar menampilkan titik', async () => {
    const screen = await render(<TicketTimeline steps={steps} />)

    await expect.element(screen.getByText('2/4')).toBeInTheDocument()
    await expect
      .element(screen.getByText('2 dari 4 tahap selesai'))
      .toBeInTheDocument()
  })

  it('membedakan selesai, sedang berjalan, dan belum lewat tanpa warna saja', async () => {
    const screen = await render(<TicketTimeline steps={steps} />)

    // Dua tahap selesai, satu berjalan, satu belum: status ini juga dibacakan
    // pembaca layar, jadi tidak bergantung pada warna titik.
    const done = await screen.getByText('selesai', { exact: true }).all()
    expect(done).toHaveLength(2)
    await expect
      .element(screen.getByText('sedang berjalan'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('belum', { exact: true }))
      .toBeInTheDocument()
  })

  it('menandai tahap yang sedang berjalan untuk pembaca layar', async () => {
    await render(<TicketTimeline steps={steps} />)

    const current = document.querySelector('[aria-current="step"]')
    expect(current?.textContent).toContain('Selesai proses')
  })

  it('tidak menandai tahap mana pun berjalan sebelum truk masuk gate', async () => {
    const beforeGate = steps.map((step) => ({ ...step, at: null }))
    const screen = await render(<TicketTimeline steps={beforeGate} />)

    expect(document.querySelector('[aria-current="step"]')).toBeNull()
    await expect.element(screen.getByText('0/4')).toBeInTheDocument()
  })

  it('menampilkan tanda pisah untuk waktu yang belum ada', async () => {
    const screen = await render(<TicketTimeline steps={steps} />)

    // Dua tahap belum lewat, jadi dua sel waktu berisi tanda pisah. Em dash,
    // bukan tanda hubung: `-` setinggi titik linimasa dan terbaca seperti noda.
    const dashes = await screen.getByText('—', { exact: true }).all()
    expect(dashes).toHaveLength(2)
  })
})
