import { describe, expect, it } from 'vitest'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import {
  clockLabel,
  dockFilterCounts,
  dockPhase,
  groupDocks,
  matchesDockQuery,
  processClock,
  waitingCount,
} from './dock-model'

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
    status: 'DOCK_ASSIGNED',
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
    assignedDock: null,
    timeLog: null,
    ...overrides,
  }
}

function makeDock(overrides: Partial<DockWithBooking> = {}): DockWithBooking {
  return {
    id: 1,
    dockCode: 'L1',
    allowedActivity: 'BOTH',
    currentStatus: 'AVAILABLE',
    areaName: null,
    warehouse: { id: 1, name: 'Gudang Utama' },
    currentBooking: null,
    ...overrides,
  }
}

function withClock(startedAt: string | null, status: Booking['status'] = 'IN_PROGRESS') {
  return makeDock({
    currentStatus: 'OCCUPIED',
    currentBooking: makeBooking({
      status,
      timeLog: {
        vehicleCompletedAt: null,
        gateInAt: '2026-11-11T08:55:00.000Z',
        dockAssignedAt: '2026-11-11T09:00:00.000Z',
        processStartedAt: startedAt,
        processCompletedAt: null,
        gateOutAt: null,
      },
    }),
  })
}

describe('dockPhase', () => {
  it('membedakan siap dimulai, diproses, kosong, dan perawatan', () => {
    expect(dockPhase(makeDock())).toBe('available')
    expect(
      dockPhase(
        makeDock({
          currentStatus: 'OCCUPIED',
          currentBooking: makeBooking({ status: 'DOCK_ASSIGNED' }),
        })
      )
    ).toBe('starting')
    expect(dockPhase(withClock('2026-11-11T09:10:00.000Z'))).toBe('serving')
    expect(
      dockPhase(
        makeDock({
          currentStatus: 'MAINTENANCE',
          currentBooking: makeBooking({ status: 'DOCK_ASSIGNED' }),
        })
      )
    ).toBe('maintenance')
  })
})

describe('dockFilterCounts', () => {
  it('menghitung tiap saringan termasuk total', () => {
    const docks = [
      makeDock({ id: 1, dockCode: 'L1' }),
      makeDock({
        id: 2,
        dockCode: 'L2',
        currentStatus: 'OCCUPIED',
        currentBooking: makeBooking({ status: 'DOCK_ASSIGNED' }),
      }),
      withClock('2026-11-11T09:10:00.000Z'),
      makeDock({ id: 4, dockCode: 'L4', currentStatus: 'MAINTENANCE' }),
    ]

    expect(dockFilterCounts(docks)).toEqual({
      all: 4,
      action: 1,
      serving: 1,
      empty: 1,
      maintenance: 1,
    })
  })
})

describe('groupDocks', () => {
  const docks = [
    makeDock({ id: 1, dockCode: 'L1' }),
    makeDock({
      id: 2,
      dockCode: 'L2',
      currentStatus: 'OCCUPIED',
      currentBooking: makeBooking({ status: 'DOCK_ASSIGNED' }),
    }),
    makeDock({ id: 3, dockCode: 'L3', currentStatus: 'MAINTENANCE' }),
  ]

  it('mengurutkan menurut kerja checker dan membuang kelompok kosong', () => {
    const groups = groupDocks(docks, 'all', '')
    expect(groups.map((group) => group.phase)).toEqual([
      'starting',
      'available',
      'maintenance',
    ])
    expect(groups[0].docks.map((dock) => dock.dockCode)).toEqual(['L2'])
  })

  it('menyaring satu keadaan saja', () => {
    expect(groupDocks(docks, 'empty', '')).toEqual([
      { phase: 'available', docks: [docks[0]] },
    ])
  })

  it('mencari kode dock, plat, dan nama customer tanpa peduli huruf besar', () => {
    expect(matchesDockQuery(docks[1], 'l2')).toBe(true)
    expect(matchesDockQuery(docks[1], 'b 1234')).toBe(true)
    expect(matchesDockQuery(docks[1], 'alpha')).toBe(true)
    expect(matchesDockQuery(docks[1], 'gudang lain')).toBe(false)
    expect(matchesDockQuery(docks[1], '   ')).toBe(true)
  })

  it('mengembalikan kosong ketika pencarian tidak menemukan apa pun', () => {
    expect(groupDocks(docks, 'all', 'tidak-ada')).toEqual([])
  })
})

describe('processClock', () => {
  it('menghitung menit berjalan dan sisa terhadap target jadwal', () => {
    const clock = processClock(
      makeBooking({
        status: 'IN_PROGRESS',
        timeLog: {
          vehicleCompletedAt: null,
          gateInAt: null,
          dockAssignedAt: null,
          processStartedAt: '2026-11-11T09:30:00.000Z',
          processCompletedAt: null,
          gateOutAt: null,
        },
      }),
      NOW
    )

    expect(clock.elapsedMinutes).toBe(30)
    expect(clock.targetMinutes).toBe(60)
    expect(clock.remainingMinutes).toBe(30)
    expect(clock.overrunMinutes).toBe(0)
    expect(clock.tone).toBe('on-track')
  })

  it('menandai mendekati dan melewati target', () => {
    const near = processClock(
      makeBooking({
        status: 'IN_PROGRESS',
        timeLog: {
          vehicleCompletedAt: null,
          gateInAt: null,
          dockAssignedAt: null,
          processStartedAt: '2026-11-11T09:10:00.000Z',
          processCompletedAt: null,
          gateOutAt: null,
        },
      }),
      NOW
    )
    expect(near.tone).toBe('near')

    const over = processClock(
      makeBooking({
        status: 'IN_PROGRESS',
        timeLog: {
          vehicleCompletedAt: null,
          gateInAt: null,
          dockAssignedAt: null,
          processStartedAt: '2026-11-11T08:30:00.000Z',
          processCompletedAt: null,
          gateOutAt: null,
        },
      }),
      NOW
    )
    expect(over.tone).toBe('over')
    expect(over.overrunMinutes).toBe(30)
    expect(over.remainingMinutes).toBe(0)
  })

  it('memakai snapshot jadwal booking, bukan durasi jenis truk saat ini', () => {
    // Jenis truk sudah diedit jadi 30 menit, tetapi booking ini dikunci untuk
    // jadwal 09:00–10:00. Target harus tetap 60 menit.
    const clock = processClock(
      makeBooking({
        status: 'IN_PROGRESS',
        startTime: '2026-11-11T09:00:00.000Z',
        endTime: '2026-11-11T10:00:00.000Z',
        truckType: {
          id: 1,
          truckName: 'CDD',
          durationMinutes: 30,
          blocksRequired: 1,
        },
        timeLog: {
          vehicleCompletedAt: null,
          gateInAt: null,
          dockAssignedAt: null,
          processStartedAt: '2026-11-11T09:40:00.000Z',
          processCompletedAt: null,
          gateOutAt: null,
        },
      }),
      NOW
    )

    expect(clock.targetMinutes).toBe(60)
  })

  it('tidak berjalan sebelum proses dimulai', () => {
    const clock = processClock(
      makeBooking({ status: 'DOCK_ASSIGNED' }),
      NOW
    )

    expect(clock.elapsedMinutes).toBe(0)
    expect(clock.ratio).toBe(0)
  })
})

describe('clockLabel', () => {
  it('meringkas menit dan jam', () => {
    expect(clockLabel(0)).toBe('0 mnt')
    expect(clockLabel(42)).toBe('42 mnt')
    expect(clockLabel(60)).toBe('1 j')
    expect(clockLabel(125)).toBe('2 j 05 mnt')
  })
})

describe('waitingCount', () => {
  it('menjumlahkan antrean tepat waktu dan terlambat', () => {
    expect(waitingCount(undefined)).toBe(0)
    expect(
      waitingCount({
        date: '2026-11-11',
        onTime: [makeBooking({ id: 'a' })],
        late: [makeBooking({ id: 'b' }), makeBooking({ id: 'c' })],
        atDock: [],
        upcoming: [],
      })
    ).toBe(3)
  })
})
