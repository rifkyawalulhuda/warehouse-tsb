import { describe, expect, it } from 'vitest'
import type { Booking, DockWithBooking, QueueResponse } from '@/lib/api/types'
import { translate } from '@/lib/i18n/translate'
import {
  assignBlockReason,
  defaultLaneKey,
  eligibleDocks,
  firstEligibleDock,
  ineligibleAreaDocks,
  oldestWait,
  processLabel,
  queueLanes,
  queueTotals,
  waitClock,
  waitLabel,
  type Translate,
} from './queue-model'

/** Model murni tidak memakai hook, jadi tes menerjemahkan sendiri ke Indonesia. */
const t: Translate = (key, vars) => translate('id', key, vars)

const NOW = new Date('2026-11-12T10:00:00.000Z')

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    bookingCode: 'TSB-20261112-001',
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
    lateMinutes: 0,
    blocksLocked: 2,
    processTypeId: null,
    processName: null,
    processExtraMinutes: 0,
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

function withGateIn(minutesAgo: number, overrides: Partial<Booking> = {}) {
  return makeBooking({
    timeLog: {
      vehicleCompletedAt: null,
      gateInAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
      dockAssignedAt: null,
      processStartedAt: null,
      processCompletedAt: null,
      gateOutAt: null,
    },
    ...overrides,
  })
}

function makeQueue(overrides: Partial<QueueResponse> = {}): QueueResponse {
  return {
    date: '2026-11-12',
    onTime: [],
    late: [],
    atDock: [],
    upcoming: [],
    ...overrides,
  }
}

describe('waitClock', () => {
  it('is null for a truck that has not gate-in yet', () => {
    const booking = makeBooking({
      timeLog: { ...makeBooking().timeLog!, gateInAt: null },
    })

    expect(waitClock(booking, NOW)).toBeNull()
  })

  it('turns amber at one slot block and red at two', () => {
    expect(waitClock(withGateIn(0), NOW)?.tone).toBe('fresh')
    expect(waitClock(withGateIn(29), NOW)?.tone).toBe('fresh')
    expect(waitClock(withGateIn(30), NOW)?.tone).toBe('waiting')
    expect(waitClock(withGateIn(59), NOW)?.tone).toBe('waiting')
    expect(waitClock(withGateIn(60), NOW)?.tone).toBe('long')
  })

  it('counts whole minutes and never goes negative', () => {
    expect(waitClock(withGateIn(24), NOW)?.minutes).toBe(24)
    // gate-in "di masa depan" karena jam mesin bergeser: tetap 0, bukan negatif.
    expect(waitClock(withGateIn(-10), NOW)?.minutes).toBe(0)
  })
})

describe('waitLabel', () => {
  it('writes minutes below an hour and pads the rest', () => {
    expect(waitLabel(24, t)).toBe('24 mnt')
    expect(waitLabel(60, t)).toBe('1 j')
    expect(waitLabel(65, t)).toBe('1 j 05 mnt')
  })
})

describe('queueLanes', () => {
  it('keeps the working order of the four stages', () => {
    expect(queueLanes(makeQueue()).map((lane) => lane.key)).toEqual([
      'late',
      'onTime',
      'atDock',
      'upcoming',
    ])
  })

  it('puts the truck that has waited longest first', () => {
    const shortWait = withGateIn(5, { id: 'short' })
    const longWait = withGateIn(45, { id: 'long' })

    const [, onTime] = queueLanes(makeQueue({ onTime: [shortWait, longWait] }))

    expect(onTime.bookings.map((booking) => booking.id)).toEqual([
      'long',
      'short',
    ])
  })

  it('orders upcoming trucks by schedule, not by insertion', () => {
    const later = makeBooking({
      id: 'later',
      startTime: '2026-11-12T14:00:00.000Z',
      timeLog: null,
    })
    const earlier = makeBooking({
      id: 'earlier',
      startTime: '2026-11-12T08:00:00.000Z',
      timeLog: null,
    })

    const upcoming = queueLanes(makeQueue({ upcoming: [later, earlier] }))[3]

    expect(upcoming.bookings.map((booking) => booking.id)).toEqual([
      'earlier',
      'later',
    ])
  })
})

describe('queueTotals', () => {
  it('counts every stage and singles out the late ones', () => {
    const totals = queueTotals(
      makeQueue({
        late: [makeBooking({ id: 'a' })],
        onTime: [makeBooking({ id: 'b' }), makeBooking({ id: 'c' })],
        atDock: [makeBooking({ id: 'd' })],
        upcoming: [makeBooking({ id: 'e' })],
      })
    )

    expect(totals).toEqual({ total: 5, waiting: 3, late: 1, atDock: 1 })
  })
})

describe('defaultLaneKey', () => {
  it('opens the first stage that has trucks', () => {
    const lanes = queueLanes(
      makeQueue({ atDock: [makeBooking()], upcoming: [makeBooking()] })
    )

    expect(defaultLaneKey(lanes)).toBe('atDock')
  })

  it('falls back to the late lane when the day is empty', () => {
    expect(defaultLaneKey(queueLanes(makeQueue()))).toBe('late')
  })
})

describe('eligibleDocks', () => {
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

  it('orders D2 before D10 so one-click assignment is predictable', () => {
    const docks = [
      makeDock({ id: 10, dockCode: 'D10' }),
      makeDock({ id: 2, dockCode: 'D2' }),
      makeDock({ id: 3, dockCode: 'D3' }),
    ]

    expect(
      eligibleDocks({ activityType: 'UNLOADING' }, docks).map((d) => d.dockCode)
    ).toEqual(['D2', 'D3', 'D10'])
    expect(
      firstEligibleDock({ activityType: 'UNLOADING' }, docks)?.dockCode
    ).toBe('D2')
  })

  it('only offers docks that are free and serve the activity', () => {
    const docks = [
      makeDock({ id: 1, dockCode: 'D1', currentStatus: 'OCCUPIED' }),
      makeDock({ id: 2, dockCode: 'D2', currentStatus: 'MAINTENANCE' }),
      makeDock({ id: 3, dockCode: 'D3', allowedActivity: 'LOADING' }),
      makeDock({ id: 4, dockCode: 'D4', allowedActivity: 'BOTH' }),
    ]

    expect(
      eligibleDocks({ activityType: 'UNLOADING' }, docks).map((d) => d.dockCode)
    ).toEqual(['D4'])
  })

  it('returns null when nothing is free, so the card can say so', () => {
    expect(
      firstEligibleDock({ activityType: 'LOADING' }, [
        makeDock({ allowedActivity: 'UNLOADING' }),
      ])
    ).toBeNull()
  })
})

describe('area gudang per customer', () => {
  function makeDock(overrides: Partial<DockWithBooking> = {}): DockWithBooking {
    return {
      id: 1,
      dockCode: 'D1',
      allowedActivity: 'BOTH',
      currentStatus: 'AVAILABLE',
      areaName: null,
      warehouse: { id: 1, name: 'Gudang WH1' },
      currentBooking: null,
      ...overrides,
    }
  }

  const wh1 = makeDock({ id: 1, dockCode: 'D1', warehouse: { id: 1, name: 'Gudang WH1' } })
  const wh2 = makeDock({ id: 2, dockCode: 'D2', warehouse: { id: 2, name: 'Gudang WH2' } })

  it('customer tanpa batasan boleh memakai semua gudang', () => {
    const booking = makeBooking({
      customer: { id: 'cust-1', name: 'PT Alpha', code: 'ALPHA' },
    })

    expect(
      eligibleDocks(booking, [wh1, wh2]).map((dock) => dock.dockCode)
    ).toEqual(['D1', 'D2'])
    expect(ineligibleAreaDocks(booking, [wh1, wh2])).toEqual([])
  })

  it('customer terbatas hanya ditawari dock di gudangnya', () => {
    const booking = makeBooking({
      customer: { id: 'cust-1', name: 'CV Mitra Niaga', code: 'MITRA', warehouseIds: [2] },
    })

    expect(
      eligibleDocks(booking, [wh1, wh2]).map((dock) => dock.dockCode)
    ).toEqual(['D2'])
    expect(
      firstEligibleDock(booking, [wh1, wh2])?.dockCode
    ).toBe('D2')
  })

  it('dock di luar area dipisah, bukan dibuang, agar checker bisa menjelaskan', () => {
    const booking = makeBooking({
      customer: { id: 'cust-1', name: 'CV Mitra Niaga', code: 'MITRA', warehouseIds: [2] },
    })

    // Dock WH1 tetap muncul — hanya di daftar terpisah.
    expect(
      ineligibleAreaDocks(booking, [wh1, wh2]).map((dock) => dock.dockCode)
    ).toEqual(['D1'])
  })

  it('dock di luar area tidak ikut dihitung saat mencari dock bebas pertama', () => {
    const booking = makeBooking({
      customer: { id: 'cust-1', name: 'CV Mitra Niaga', code: 'MITRA', warehouseIds: [1] },
    })

    // WH1 sedang dipakai; D2 bebas tetapi bukan areanya, jadi tidak ada pilihan.
    expect(
      firstEligibleDock(booking, [
        { ...wh1, currentStatus: 'OCCUPIED' },
        wh2,
      ])
    ).toBeNull()
  })
})

describe('oldestWait', () => {
  it('reports the longest wait in the lane', () => {
    const lanes = queueLanes(
      makeQueue({
        late: [
          makeBooking({
            timeLog: {
              ...makeBooking().timeLog!,
              gateInAt: '2026-11-12T09:36:00.000Z',
            },
          }),
          makeBooking({
            id: 'booking-2',
            timeLog: {
              ...makeBooking().timeLog!,
              gateInAt: '2026-11-12T09:00:00.000Z',
            },
          }),
        ],
      })
    )

    expect(oldestWait(lanes[0]!, NOW)?.minutes).toBe(60)
  })

  it('is null when nobody in the lane has passed the gate yet', () => {
    const lanes = queueLanes(
      makeQueue({
        upcoming: [makeBooking({ timeLog: null })],
      })
    )

    expect(oldestWait(lanes[3]!, NOW)).toBeNull()
  })
})

describe('processLabel', () => {
  it('menulis nama jenis proses beserta tambahan menitnya', () => {
    expect(
      processLabel(
        { processName: 'Curah', processExtraMinutes: 30 },
        t
      )
    ).toBe('Curah · +30 mnt')
  })

  it('tidak menampilkan apa pun untuk booking lama tanpa jenis proses', () => {
    expect(
      processLabel({ processName: null, processExtraMinutes: 0 }, t)
    ).toBeNull()
  })
})

describe('assignBlockReason', () => {
  it('blames the busy docks when none is free', () => {
    expect(assignBlockReason(makeBooking(), [], t)).toBe(
      'Semua dock sedang terpakai'
    )
  })

  it('names the activity the free docks cannot serve', () => {
    const loadingOnly: DockWithBooking = {
      id: 3,
      dockCode: 'D3',
      allowedActivity: 'LOADING',
      currentStatus: 'AVAILABLE',
      areaName: null,
      warehouse: { id: 1, name: 'Gudang Utama' },
      currentBooking: null,
    }
    const unloadingOnly: DockWithBooking = {
      ...loadingOnly,
      id: 7,
      dockCode: 'D7',
      allowedActivity: 'UNLOADING',
    }

    expect(assignBlockReason(makeBooking(), [loadingOnly], t)).toBe(
      'Dock yang kosong tidak melayani bongkar'
    )
    expect(
      assignBlockReason(
        makeBooking({ activityType: 'LOADING' }),
        [unloadingOnly],
        t
      )
    ).toBe('Dock yang kosong tidak melayani muat')
  })
})
