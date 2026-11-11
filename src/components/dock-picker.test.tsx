import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { DockPicker } from './dock-picker'

const docks = [
  { id: 1, dockCode: 'D1', areaName: 'Area A' },
  { id: 2, dockCode: 'D2', areaName: 'Area A' },
  { id: 3, dockCode: 'L1', areaName: 'Area B' },
  { id: 4, dockCode: 'L2', areaName: 'Area B' },
]

describe('DockPicker', () => {
  it('shows the placeholder before anything is picked', async () => {
    const { getByRole } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await expect
      .element(getByRole('combobox', { name: 'Pilih dock' }))
      .toBeInTheDocument()
  })

  it('filters the list while typing', async () => {
    const { getByRole, getByPlaceholder } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await userEvent.click(getByRole('combobox', { name: 'Pilih dock' }))
    await userEvent.type(getByPlaceholder('Cari kode dock…'), 'l1')

    await expect.element(getByRole('option', { name: /L1/ })).toBeInTheDocument()
    await expect
      .element(getByRole('option', { name: /D1/ }))
      .not.toBeInTheDocument()
  })

  it('calls back with the chosen dock and shows it on the trigger', async () => {
    const onSelect = vi.fn()
    const { getByRole } = await render(
      <DockPicker
        docks={docks}
        onSelect={onSelect}
        label='Pilih dock untuk TSB-20261111-001'
      />
    )

    await userEvent.click(
      getByRole('combobox', { name: 'Pilih dock untuk TSB-20261111-001' })
    )
    await userEvent.click(getByRole('option', { name: /L2/ }))

    expect(onSelect).toHaveBeenCalledWith(docks[3])
    await expect
      .element(
        getByRole('combobox', { name: 'Pilih dock untuk TSB-20261111-001' })
      )
      .toHaveTextContent('L2')
  })

  it('explains when the search matches nothing', async () => {
    const { getByRole, getByPlaceholder, getByText } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await userEvent.click(getByRole('combobox', { name: 'Pilih dock' }))
    await userEvent.type(getByPlaceholder('Cari kode dock…'), 'zzz')

    await expect
      .element(getByText('Tidak ada dock yang cocok.'))
      .toBeInTheDocument()
  })
})
