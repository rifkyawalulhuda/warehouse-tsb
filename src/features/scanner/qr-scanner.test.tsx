import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { QrScanner } from './qr-scanner'

const PLACEHOLDER = 'Token QR atau kode booking'

describe('QrScanner', () => {
  it('mengirim kode booking yang diketik manual dalam huruf besar', async () => {
    const onScan = vi.fn()
    const { getByPlaceholder, getByRole } = await render(
      <QrScanner onScan={onScan} />
    )

    await userEvent.fill(getByPlaceholder(PLACEHOLDER), 'tsb-20261111-003')
    await userEvent.click(getByRole('button', { name: 'Cek' }))

    expect(onScan).toHaveBeenCalledWith('TSB-20261111-003')
  })

  it('mengirim token QR hasil tempel apa adanya', async () => {
    const onScan = vi.fn()
    const { getByPlaceholder, getByRole } = await render(
      <QrScanner onScan={onScan} />
    )

    await userEvent.fill(
      getByPlaceholder(PLACEHOLDER),
      'Xk3pQ9rT2mZ7vB1nL5wY8cD4'
    )
    await userEvent.click(getByRole('button', { name: 'Cek' }))

    expect(onScan).toHaveBeenCalledWith('Xk3pQ9rT2mZ7vB1nL5wY8cD4')
  })

  it('menonaktifkan tombol Cek untuk masukan yang tidak dikenali', async () => {
    const { getByPlaceholder, getByRole } = await render(
      <QrScanner onScan={() => undefined} />
    )

    await userEvent.fill(getByPlaceholder(PLACEHOLDER), 'halo')

    await expect.element(getByRole('button', { name: 'Cek' })).toBeDisabled()
  })
})
