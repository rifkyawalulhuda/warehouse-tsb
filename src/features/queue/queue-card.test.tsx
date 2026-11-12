import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { QueueCard } from './queue-card'

const NOW = new Date('2026-11-12T10:00:00.000Z')

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    bookingCode: 'TSB-20261112-007',
    qrToken: 'token',
    activityType: 'UNLOADING',
    bookingDate: '2026-11-12',
    startTime: '2026-11-12T09:00:00.000Z',
    endTime: '2026-11-12T10:00:00.000Z',
    referenceDocNo: 'SJ-1',
    licensePlate: 'B 1234 CD',
    driverName: 'Joko',
    driverPhone: '0812',
    status: 'LATE_WAITING_LIST',
    lateMinutes: 18,
    blocksLocked: 2,
    approvalStatus: 'NOT_REQUIRED',
    approvalDeadline: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-11-11T00:00:00.000Z',
    customer: { id: 'cust-1', name: 'PT Alpha Logistik', code: 'ALPHA' },
    createdBy: { id: 'user-1', name: 'Budi' },
    truckType: {
      id: 1,
      truckName: 'CDD',
      durationMinutes: 60,
      blocksRequired: 2,
    },
    assignedDock: null,
    timeLog: {
      vehicleCompletedAt: null,
      gateInAt: '2026-11-12T09:36:00.000Z',
      dockAssignedAt: null,
      processStartedAt: null,
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
    currentStatus: 'AVAILABLE',
    areaName: null,
    warehouse: { id: 1, name: 'Gudang Utama' },
    currentBooking: null,
    ...overrides,
  }
}

describe('QueueCard', () => {
  it('shows how long the truck has waited and how late it is', async () => {
    const { getByText } = await render(
      <QueueCard booking={makeBooking()} laneKey='late' now={NOW} />
    )

    await expect.element(getByText('Menunggu 24 mnt')).toBeInTheDocument()
    await expect.element(getByText('+18 mnt dari jadwal')).toBeInTheDocument()
  })

  it('marks no-show from the card with the booking code in the label', async () => {
    const onNoShow = vi.fn()
    const { getByRole } = await render(
      <QueueCard
        booking={makeBooking()}
        laneKey='late'
        now={NOW}
        onNoShow={onNoShow}
      />
    )

    await userEvent.click(
      getByRole('button', { name: 'Tandai TSB-20261112-007 tidak datang' })
    )

    expect(onNoShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1' })
    )
  })

  it('says a truck has not arrived instead of showing a wait clock', async () => {
    const { getByText, container } = await render(
      <QueueCard
        booking={makeBooking({ status: 'BOOKED_READY', timeLog: null })}
        laneKey='upcoming'
        now={NOW}
      />
    )

    await expect.element(getByText(/Belum gate-in/)).toBeInTheDocument()
    expect(container.textContent).not.toContain('Menunggu')
  })

  it('explains that no compatible dock is free instead of hiding the action', async () => {
    const { getByText } = await render(
      <QueueCard
        booking={makeBooking()}
        laneKey='late'
        now={NOW}
        docks={[]}
        onQuickAssign={vi.fn()}
      />
    )

    await expect
      .element(getByText('Semua dock sedang terpakai'))
      .toBeInTheDocument()
  })

  it('names the activity when the free docks cannot serve it', async () => {
    const { getByText } = await render(
      <QueueCard
        booking={makeBooking()}
        laneKey='late'
        now={NOW}
        docks={[makeDock({ dockCode: 'D3', allowedActivity: 'LOADING' })]}
        onQuickAssign={vi.fn()}
      />
    )

    await expect
      .element(getByText('Dock yang kosong tidak melayani bongkar'))
      .toBeInTheDocument()
  })

  it('assigns to the first free dock in one click and names it on the button', async () => {
    const onQuickAssign = vi.fn()
    const { getByRole } = await render(
      <QueueCard
        booking={makeBooking()}
        laneKey='late'
        now={NOW}
        // Sengaja tidak urut: D10 tidak boleh dipilih sebelum D2.
        docks={[
          makeDock({ id: 10, dockCode: 'D10' }),
          makeDock({ id: 2, dockCode: 'D2' }),
        ]}
        onQuickAssign={onQuickAssign}
      />
    )

    await userEvent.click(
      getByRole('button', { name: 'Tugaskan TSB-20261112-007 ke D2' })
    )

    expect(onQuickAssign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1' }),
      expect.objectContaining({ dockCode: 'D2' })
    )
  })

  it('skips docks that are busy or serve the other activity', async () => {
    const onQuickAssign = vi.fn()
    const { getByRole, container } = await render(
      <QueueCard
        booking={makeBooking()}
        laneKey='late'
        now={NOW}
        docks={[
          makeDock({ id: 1, dockCode: 'D1', currentStatus: 'OCCUPIED' }),
          makeDock({ id: 2, dockCode: 'D2', allowedActivity: 'LOADING' }),
          makeDock({ id: 3, dockCode: 'D3', allowedActivity: 'UNLOADING' }),
        ]}
        onQuickAssign={onQuickAssign}
      />
    )

    await userEvent.click(getByRole('button', { name: /ke D3/ }))
    expect(onQuickAssign).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dockCode: 'D3' })
    )
    expect(container.textContent).not.toContain('ke D1')
  })
})
