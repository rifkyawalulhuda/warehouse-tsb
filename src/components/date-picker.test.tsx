import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { formatDate } from '@/lib/format'
import { DatePicker } from './date-picker'

describe('DatePicker', () => {
  it('shows the placeholder when no date is selected', async () => {
    const { getByRole } = await render(
      <DatePicker onChange={vi.fn()} placeholder='Pilih tanggal' />
    )

    await expect
      .element(getByRole('button', { name: 'Pilih tanggal' }))
      .toBeInTheDocument()
  })

  it('formats the selected ISO date like the rest of the app', async () => {
    const { getByRole } = await render(
      <DatePicker value='2026-11-10' onChange={vi.fn()} />
    )

    await expect
      .element(getByRole('button', { name: formatDate('2026-11-10') }))
      .toBeInTheDocument()
  })

  it('opens the calendar and emits an ISO date when a day is picked', async () => {
    const onChange = vi.fn()
    const { getByRole, getByRole: query } = await render(
      <DatePicker value='2026-11-10' onChange={onChange} />
    )

    await userEvent.click(
      getByRole('button', { name: formatDate('2026-11-10') })
    )
    await userEvent.click(query('button', { name: /15 November 2026/ }))

    expect(onChange).toHaveBeenCalledWith('2026-11-15')
  })

  it('closes the calendar after a day is picked', async () => {
    const { getByRole } = await render(
      <DatePicker value='2026-11-10' onChange={vi.fn()} />
    )

    await userEvent.click(
      getByRole('button', { name: formatDate('2026-11-10') })
    )
    await userEvent.click(getByRole('button', { name: /15 November 2026/ }))

    await expect
      .element(getByRole('button', { name: /15 November 2026/ }))
      .not.toBeInTheDocument()
  })

  it('labels its controls in Indonesian', async () => {
    const { getByRole } = await render(
      <DatePicker value='2026-11-10' onChange={vi.fn()} />
    )

    await userEvent.click(
      getByRole('button', { name: formatDate('2026-11-10') })
    )

    await expect
      .element(getByRole('button', { name: 'Bulan berikutnya' }))
      .toBeInTheDocument()
    await expect
      .element(
        getByRole('button', { name: /^Hari ini, Selasa, 10 November 2026$/ })
      )
      .toBeInTheDocument()
  })

  it('disables days before min', async () => {
    const { getByRole } = await render(
      <DatePicker value='2026-11-10' min='2026-11-10' onChange={vi.fn()} />
    )

    await userEvent.click(
      getByRole('button', { name: formatDate('2026-11-10') })
    )

    await expect
      .element(getByRole('button', { name: /\b9 November 2026/ }))
      .toBeDisabled()
    await expect
      .element(getByRole('button', { name: /\b10 November 2026/ }))
      .toBeEnabled()
  })

  it('disables days after max', async () => {
    const { getByRole } = await render(
      <DatePicker value='2026-11-10' max='2026-11-10' onChange={vi.fn()} />
    )

    await userEvent.click(
      getByRole('button', { name: formatDate('2026-11-10') })
    )

    await expect
      .element(getByRole('button', { name: /\b11 November 2026/ }))
      .toBeDisabled()
    await expect
      .element(getByRole('button', { name: /\b10 November 2026/ }))
      .toBeEnabled()
  })
})
