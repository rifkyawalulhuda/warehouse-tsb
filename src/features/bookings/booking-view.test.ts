import { describe, expect, it } from 'vitest'
import type { Booking } from '@/lib/api/types'
import {
  bookingUrgency,
  dockLabel,
  filterCounts,
  filtersFor,
  groupByDay,
  matchesFilter,
  needsAction,
  parseViewMode,
  pickNextBooking,
} from './booking-view'

function booking(partial: Partial<Booking> & Pick<Booking, 'bookingCode'>): Booking {
  return {
    id: partial.bookingCode,
    qrToken: `token-${partial.bookingCode}`,
    activityType: 'LOADING',
    bookingDate: '2026-11-10',
    startTime: '2026-11-10T02:00:00.000Z',
    endTime: '2026-11-10T03:00:00.000Z',
    referenceDocNo: 'DO-1',
    licensePlate: 'B 1234 XYZ',
    driverName: 'Budi',
    driverPhone: null,
    status: 'BOOKED_READY',
    lateMinutes: 0,
    blocksLocked: 2,
    approvalStatus: 'NOT_REQUIRED',
    approvalDeadline: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    customer: { id: 'c1', name: 'PT A', code: 'ACME' },
    createdBy: { id: 'u1', name: 'Sari' },
    truckType: {
      id: 1,
      truckName: 'CDD',
      durationMinutes: 60,
      blocksRequired: 2,
    },
    assignedDock: null,
    timeLog: null,
    ...partial,
  }
}

describe('parseViewMode', () => {
  it('keeps every known mode', () => {
    expect(parseViewMode('list')).toBe('list')
    expect(parseViewMode('grid')).toBe('grid')
    expect(parseViewMode('schedule')).toBe('schedule')
  })

  it('falls back to list for unknown or missing values', () => {
    expect(parseViewMode(undefined)).toBe('list')
    expect(parseViewMode('')).toBe('list')
    expect(parseViewMode('kanban')).toBe('list')
  })
})

describe('needsAction', () => {
  it('flags incomplete vehicle data', () => {
    expect(needsAction(booking({ bookingCode: 'A', status: 'BOOKED_INCOMPLETE' }))).toBe(true)
  })

  it('flags pending approval even when the vehicle is complete', () => {
    expect(needsAction(booking({ bookingCode: 'A', approvalStatus: 'PENDING' }))).toBe(true)
  })

  it('ignores rejected and expired bookings', () => {
    expect(needsAction(booking({ bookingCode: 'A', approvalStatus: 'REJECTED' }))).toBe(false)
    expect(needsAction(booking({ bookingCode: 'A', approvalStatus: 'EXPIRED' }))).toBe(false)
  })
})

describe('matchesFilter', () => {
  it('separates on-site bookings from ready ones', () => {
    const ready = booking({ bookingCode: 'A' })
    const onsite = booking({ bookingCode: 'B', status: 'DOCK_ASSIGNED' })

    expect(matchesFilter(ready, 'ready')).toBe(true)
    expect(matchesFilter(ready, 'onsite')).toBe(false)
    expect(matchesFilter(onsite, 'ready')).toBe(false)
    expect(matchesFilter(onsite, 'onsite')).toBe(true)
    expect(matchesFilter(onsite, 'all')).toBe(true)
  })

  it('counts every group in one pass', () => {
    const counts = filterCounts([
      booking({ bookingCode: 'A' }),
      booking({ bookingCode: 'B', status: 'BOOKED_INCOMPLETE' }),
      booking({ bookingCode: 'C', status: 'IN_PROGRESS' }),
    ])

    expect(counts).toEqual({
      all: 3,
      action: 1,
      ready: 1,
      onsite: 1,
      done: 0,
      cancelled: 0,
      noshow: 0,
    })
  })

  it('separates finished, cancelled and no-show bookings', () => {
    const done = booking({ bookingCode: 'A', status: 'COMPLETED' })
    const out = booking({ bookingCode: 'B', status: 'CHECKED_OUT' })
    const cancelled = booking({ bookingCode: 'C', status: 'CANCELLED' })
    const noShow = booking({ bookingCode: 'D', status: 'NO_SHOW' })

    expect(matchesFilter(done, 'done')).toBe(true)
    expect(matchesFilter(out, 'done')).toBe(true)
    expect(matchesFilter(cancelled, 'cancelled')).toBe(true)
    expect(matchesFilter(noShow, 'noshow')).toBe(true)

    expect(matchesFilter(done, 'cancelled')).toBe(false)
    expect(matchesFilter(cancelled, 'done')).toBe(false)
    expect(matchesFilter(noShow, 'done')).toBe(false)
  })

  it('offers different chips for active and past scopes', () => {
    expect(filtersFor('active')).toEqual(['all', 'action', 'ready', 'onsite'])
    expect(filtersFor('past')).toEqual(['all', 'done', 'cancelled', 'noshow'])
  })
})

describe('dockLabel', () => {
  it('uses one wording for every view', () => {
    const undecided = booking({ bookingCode: 'A' })
    const assigned = booking({
      bookingCode: 'B',
      assignedDock: { id: 1, dockCode: 'D4', allowedActivity: 'UNLOADING' },
    })

    expect(dockLabel(undecided)).toBe('Ditentukan saat check-in')
    expect(dockLabel(assigned)).toBe('D4')
  })
})

describe('pickNextBooking', () => {
  const now = new Date('2026-11-10T01:00:00.000Z')

  it('skips bookings that already ended', () => {
    const past = booking({
      bookingCode: 'PAST',
      startTime: '2026-11-09T02:00:00.000Z',
      endTime: '2026-11-09T03:00:00.000Z',
    })
    const future = booking({
      bookingCode: 'NEXT',
      startTime: '2026-11-10T04:00:00.000Z',
      endTime: '2026-11-10T05:00:00.000Z',
    })

    expect(pickNextBooking([past, future], now)?.bookingCode).toBe('NEXT')
  })

  it('picks the earliest remaining start regardless of input order', () => {
    const later = booking({
      bookingCode: 'LATER',
      startTime: '2026-11-10T06:00:00.000Z',
      endTime: '2026-11-10T07:00:00.000Z',
    })
    const sooner = booking({
      bookingCode: 'SOONER',
      startTime: '2026-11-10T02:00:00.000Z',
      endTime: '2026-11-10T03:00:00.000Z',
    })

    expect(pickNextBooking([later, sooner], now)?.bookingCode).toBe('SOONER')
  })

  it('returns null when the list is empty or entirely in the past', () => {
    expect(pickNextBooking([], now)).toBeNull()
    expect(
      pickNextBooking(
        [
          booking({
            bookingCode: 'PAST',
            startTime: '2026-11-09T02:00:00.000Z',
            endTime: '2026-11-09T03:00:00.000Z',
          }),
        ],
        now
      )
    ).toBeNull()
  })
})

describe('bookingUrgency', () => {
  // Booking mulai 02:00Z = 09:00 WIB pada 10 Nov 2026.
  const target = booking({
    bookingCode: 'A',
    startTime: '2026-11-10T02:00:00.000Z',
    endTime: '2026-11-10T03:00:00.000Z',
  })
  const at = (iso: string) => new Date(iso)

  it('reports minutes when the start is under an hour away', () => {
    expect(bookingUrgency(target, at('2026-11-10T01:45:00.000Z')).label).toBe(
      'Masuk dalam 15 menit'
    )
  })

  it('reports the hour when the booking is today', () => {
    expect(bookingUrgency(target, at('2026-11-09T20:00:00.000Z')).label).toBe(
      'Hari ini, 09.00'
    )
  })

  it('keeps the badge short so it does not repeat the big time', () => {
    expect(bookingUrgency(target, at('2026-11-09T20:00:00.000Z')).badge).toBe('Hari ini')
    expect(bookingUrgency(target, at('2026-11-09T05:00:00.000Z')).badge).toBe('Besok')
  })

  it('reports tomorrow', () => {
    expect(bookingUrgency(target, at('2026-11-09T05:00:00.000Z')).label).toBe(
      'Besok, 09.00'
    )
  })

  it('counts days beyond tomorrow', () => {
    expect(bookingUrgency(target, at('2026-11-07T05:00:00.000Z')).label).toBe('3 hari lagi')
  })

  it('marks a running booking as in progress', () => {
    const running = bookingUrgency(target, at('2026-11-10T02:30:00.000Z'))
    expect(running.key).toBe('in-progress')
    expect(running.label).toBe('Sedang berlangsung')
  })

  it('marks a finished booking as overdue', () => {
    expect(bookingUrgency(target, at('2026-11-10T04:00:00.000Z')).key).toBe('overdue')
  })
})

describe('groupByDay', () => {
  it('groups by date and keeps server order', () => {
    const days = groupByDay([
      booking({ bookingCode: 'A', bookingDate: '2026-11-10' }),
      booking({ bookingCode: 'B', bookingDate: '2026-11-12' }),
      booking({ bookingCode: 'C', bookingDate: '2026-11-10' }),
    ])

    expect(days.map((day) => day.date)).toEqual(['2026-11-10', '2026-11-12'])
    expect(days[0].items.map((item) => item.bookingCode)).toEqual(['A', 'C'])
    expect(days[0].label).toContain('10')
  })

  it('returns an empty array for no bookings', () => {
    expect(groupByDay([])).toEqual([])
  })
})
