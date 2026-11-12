import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { DockPicker } from './dock-picker'
import { dockOptionLabel, dockOptionPlace } from '@/lib/dock-label'

const warehouse = { id: 2, name: 'Warehouse 2' }

const docks = [
  { id: 1, dockCode: 'D1', areaName: 'Area A', warehouse },
  { id: 2, dockCode: 'D2', areaName: 'Area A', warehouse },
  { id: 3, dockCode: 'L1', areaName: 'Area Tengah', warehouse },
  { id: 4, dockCode: 'L2', areaName: 'Area B', warehouse },
  // Dock lama yang areanya belum diisi tetap harus terbaca.
  { id: 5, dockCode: 'D9', areaName: null, warehouse },
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
    await userEvent.type(getByPlaceholder('Cari dock, area, atau gudang…'), 'l1')

    await expect
      .element(getByRole('option', { name: /L1/ }))
      .toBeInTheDocument()
    await expect
      .element(getByRole('option', { name: /D1/ }))
      .not.toBeInTheDocument()
  })

  it('finds a dock by its area name', async () => {
    const { getByRole, getByPlaceholder } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await userEvent.click(getByRole('combobox', { name: 'Pilih dock' }))
    await userEvent.type(
      getByPlaceholder('Cari dock, area, atau gudang…'),
      'tengah'
    )

    await expect
      .element(getByRole('option', { name: /L1/ }))
      .toBeInTheDocument()
    await expect
      .element(getByRole('option', { name: /L2/ }))
      .not.toBeInTheDocument()
  })

  it('shows area and warehouse beside each dock code', async () => {
    const { getByRole, getByText } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await userEvent.click(getByRole('combobox', { name: 'Pilih dock' }))

    await expect
      .element(getByText('Area Tengah · Warehouse 2'))
      .toBeInTheDocument()
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
        getByRole('combobox', {
          name: 'Pilih dock untuk TSB-20261111-001: L2 · Area B · Warehouse 2',
        })
      )
      .toHaveTextContent('L2 · Area B · Warehouse 2')
  })

  it('explains when the search matches nothing', async () => {
    const { getByRole, getByPlaceholder, getByText } = await render(
      <DockPicker docks={docks} onSelect={vi.fn()} />
    )

    await userEvent.click(getByRole('combobox', { name: 'Pilih dock' }))
    await userEvent.type(getByPlaceholder('Cari dock, area, atau gudang…'), 'zzz')

    await expect
      .element(getByText('Tidak ada dock yang cocok.'))
      .toBeInTheDocument()
  })
})

describe('dockOptionLabel', () => {
  it('joins code, area and warehouse', () => {
    expect(dockOptionLabel(docks[2])).toBe('L1 · Area Tengah · Warehouse 2')
  })

  it('skips the parts a dock does not have', () => {
    expect(dockOptionLabel({ id: 9, dockCode: 'D9' })).toBe('D9')
    expect(dockOptionPlace({ id: 9, dockCode: 'D9' })).toBe('')
    expect(dockOptionPlace({ id: 9, dockCode: 'D9', areaName: 'Area A' })).toBe(
      'Area A'
    )
  })
})
