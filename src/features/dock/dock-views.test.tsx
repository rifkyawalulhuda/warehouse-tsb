import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { DockGrid } from './dock-grid'
import { shortClock } from './dock-model'
import { DockTable } from './dock-table'
import { DockViewSwitch } from './dock-view-switch'

const NOW = new Date('2026-11-11T10:00:00.000Z')

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    bookingCode: 'TSB-20261111-001',
    qrToken: 'token',
    activityType: 'UNLOADING',
    bookingDate: '2026-11-11',
    startTime: '2026-11-11T09:00:00.000Z',
    endTime: '2026-11-11T10:00:00.000Z',
    referenceDocNo: 'SJ-1',
    licensePlate: 'B 1234 CD',
    driverName: 'Joko',
    driverPhone: '0812',
    status: 'IN_PROGRESS',
    lateMinutes: 0,
    blocksLocked: 2,
    approvalStatus: 'NOT_REQUIRED',
    approvalDeadline: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-11-10T00:00:00.000Z',
    customer: { id: 'cust-1', name: 'PT Alpha Logistik', code: 'ALPHA' },
    createdBy: { id: 'user-1', name: 'Budi' },
    truckType: {
      id: 1,
      truckName: 'CDD',
      durationMinutes: 60,
      blocksRequired: 2,
    },
    assignedDock: { id: 1, dockCode: 'D1', allowedActivity: 'BOTH' },
    timeLog: {
      vehicleCompletedAt: null,
      gateInAt: '2026-11-11T08:55:00.000Z',
      dockAssignedAt: '2026-11-11T09:00:00.000Z',
      processStartedAt: '2026-11-11T09:05:00.000Z',
      processCompletedAt: null,
      gateOutAt: null,
    },
    ...overrides,
  }
}

function makeDock(overrides: Partial<DockWithBooking> = {}): DockWithBooking {
  return {
    id: 1,
    dockCode: 'D1',
    allowedActivity: 'BOTH',
    currentStatus: 'OCCUPIED',
    areaName: null,
    warehouse: { id: 1, name: 'Gudang Utama' },
    currentBooking: makeBooking(),
    ...overrides,
  }
}

describe('DockViewSwitch', () => {
  it('marks the active view and reports a pick', async () => {
    const onChange = vi.fn()
    const { getByRole } = await render(
      <DockViewSwitch value='cards' onChange={onChange} />
    )

    await expect
      .element(getByRole('radio', { name: 'Tampilan Kartu' }))
      .toHaveAttribute('aria-checked', 'true')

    await userEvent.click(getByRole('radio', { name: 'Tampilan Tabel' }))

    expect(onChange).toHaveBeenCalledWith('table')
  })
})

describe('DockTable', () => {
  it('shows the dock, status, booking, and finishes the process', async () => {
    const onFinish = vi.fn()
    const dock = makeDock()
    const { getByRole, getByText } = await render(
      <DockTable
        groups={[{ phase: 'serving', docks: [dock] }]}
        now={NOW}
        actionPending={false}
        onStart={vi.fn()}
        onFinish={onFinish}
      />
    )

    await expect
      .element(getByText('Sedang diproses', { exact: true }))
      .toBeInTheDocument()
    await expect.element(getByText('TSB-20261111-001')).toBeInTheDocument()

    await userEvent.click(
      getByRole('button', {
        name: 'Selesaikan proses TSB-20261111-001 di D1',
      })
    )

    expect(onFinish).toHaveBeenCalledWith(dock.currentBooking, dock)
  })

  it('offers no action for a dock without a truck', async () => {
    const { container, getByText } = await render(
      <DockTable
        groups={[
          { phase: 'available', docks: [makeDock({ currentBooking: null })] },
        ]}
        now={NOW}
        actionPending={false}
        onStart={vi.fn()}
        onFinish={vi.fn()}
      />
    )

    await expect.element(getByText('Tidak ada truk')).toBeInTheDocument()
    expect(container.querySelector('button')).toBeNull()
  })
})

describe('DockGrid', () => {
  it('shortens clock labels for narrow tiles', () => {
    expect(shortClock(35)).toBe('35m')
    expect(shortClock(60)).toBe('1j')
    expect(shortClock(215)).toBe('3j 35m')
  })

  it('starts the process from a compact tile', async () => {
    const onStart = vi.fn()
    const dock = makeDock({
      currentBooking: makeBooking({ status: 'DOCK_ASSIGNED' }),
    })
    const { getByRole, getByText } = await render(
      <DockGrid
        groups={[{ phase: 'starting', docks: [dock] }]}
        now={NOW}
        actionPending={false}
        onStart={onStart}
        onFinish={vi.fn()}
      />
    )

    await expect.element(getByText('Siap')).toBeInTheDocument()

    await userEvent.click(
      getByRole('button', { name: 'Mulai proses TSB-20261111-001 di D1' })
    )

    expect(onStart).toHaveBeenCalledWith(dock.currentBooking, dock)
  })
})
