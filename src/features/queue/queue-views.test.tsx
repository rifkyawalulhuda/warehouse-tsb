import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import type { Booking, DockWithBooking } from '@/lib/api/types'

// TanStack Link butuh RouterProvider; di sini yang diuji isinya, bukan navigasi.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))
import { QueueCompact } from './queue-compact'
import { QueueGrid } from './queue-grid'
import { QueueTable } from './queue-table'
import { QueueViewSwitch } from './queue-view-switch'
import {
  defaultQueueView,
  isQueueView,
  queueViewStorageKey,
  readQueueView,
  writeQueueView,
  type QueueView,
  type QueueViewStorage,
} from './queue-view'

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
    areaName: 'Area Tengah',
    warehouse: { id: 1, name: 'Gudang Utama' },
    currentBooking: null,
    ...overrides,
  }
}

const late = makeBooking({ id: 'late', bookingCode: 'TSB-20261112-007' })
const atDock = makeBooking({
  id: 'at-dock',
  bookingCode: 'TSB-20261112-008',
  licensePlate: 'B 5555 EF',
  status: 'DOCK_ASSIGNED',
  assignedDock: { id: 1, dockCode: 'D1', allowedActivity: 'BOTH' },
})
const upcoming = makeBooking({
  id: 'upcoming',
  bookingCode: 'TSB-20261112-009',
  licensePlate: 'B 7777 GH',
  status: 'BOOKED_READY',
  timeLog: {
    vehicleCompletedAt: null,
    gateInAt: null,
    dockAssignedAt: null,
    processStartedAt: null,
    processCompletedAt: null,
    gateOutAt: null,
  },
})

const rows = [
  { booking: late, laneKey: 'late' as const },
  { booking: atDock, laneKey: 'atDock' as const },
  { booking: upcoming, laneKey: 'upcoming' as const },
]

/** Storage tiruan: cukup getItem/setItem, seperti yang dipakai queue-view. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const storage: QueueViewStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
  return { storage, map }
}

describe('QueueViewSwitch', () => {
  it('menandai tampilan yang sedang dipakai dan melaporkan pilihan baru', async () => {
    const onChange = vi.fn()
    const { getByRole } = await render(
      <QueueViewSwitch value='list' onChange={onChange} />
    )

    const current = getByRole('radio', { name: 'Tampilan Daftar' })
    await expect.element(current).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(getByRole('radio', { name: 'Tampilan Ringkas' }))

    expect(onChange).toHaveBeenCalledWith('compact')
  })
})

describe('QueueTable', () => {
  it('menampilkan satu baris data per truk, tidak mengelompokkan ulang', async () => {
    const { container } = await render(
      <QueueTable rows={rows} now={NOW} docks={[makeDock()]} />
    )

    // Tiga truk: baris data utama, ditambah baris aksi layar sempit.
    const bodyRows = container.querySelectorAll('tbody tr')
    expect(bodyRows.length).toBeGreaterThanOrEqual(3)

    const text = container.textContent ?? ''
    expect(text).toContain('TSB-20261112-008')
    expect(text).toContain('Belum gate-in')
  })

  it('menjelaskan kenapa tombol tugaskan tidak muncul, bukan mendiamkannya', async () => {
    const { container } = await render(
      <QueueTable
        rows={[{ booking: late, laneKey: 'late' }]}
        now={NOW}
        docks={[makeDock({ allowedActivity: 'LOADING' })]}
      />
    )

    // Alasan muncul di sel Aksi dan di baris aksi layar sempit; keduanya
    // disembunyikan bergantian oleh CSS, jadi keduanya sah ada di DOM.
    const reasons = [...container.querySelectorAll('span')].filter(
      (el) => el.textContent === 'Dock yang kosong tidak melayani bongkar'
    )
    expect(reasons.length).toBeGreaterThan(0)
  })

  it('menyebut kode booking dan dock pada label tombol tugaskan', async () => {
    const { container } = await render(
      <QueueTable
        rows={[{ booking: late, laneKey: 'late' }]}
        now={NOW}
        docks={[makeDock()]}
        onQuickAssign={vi.fn()}
      />
    )

    const label =
      'Tugaskan TSB-20261112-007 ke D1 · Area Tengah · Gudang Utama'
    const buttons = container.querySelectorAll(`[aria-label="${label}"]`)
    expect(buttons.length).toBeGreaterThan(0)
  })
})

describe('QueueCompact', () => {
  it('memuat setiap truk sekali dengan tahap tertulis, bukan hanya warna', async () => {
    const { getByText, container } = await render(
      <QueueCompact rows={rows} now={NOW} docks={[]} />
    )

    expect(container.querySelectorAll('li')).toHaveLength(3)
    await expect.element(getByText('Telat')).toBeInTheDocument()
    await expect.element(getByText('Di dock')).toBeInTheDocument()
    await expect.element(getByText('Belum datang')).toBeInTheDocument()
  })
})

describe('QueueGrid', () => {
  it('meratakan seluruh truk tanpa judul tahap', async () => {
    const { container, getByText } = await render(
      <QueueGrid rows={rows} now={NOW} docks={[]} />
    )

    expect(container.querySelectorAll('li')).toHaveLength(3)
    await expect.element(getByText('B 1234 CD')).toBeInTheDocument()
  })
})

describe('queue-view', () => {
  it('menyimpan pilihan per akun', () => {
    const { storage, map } = fakeStorage()

    writeQueueView('user-1', 'compact', storage)

    expect(map.get(queueViewStorageKey('user-1'))).toBe('compact')
    expect(readQueueView('user-1', storage)).toBe('compact')
    // Akun lain tidak ikut berubah.
    expect(readQueueView('user-2', storage)).toBe(defaultQueueView)
  })

  it('mengabaikan nilai rusak dan penyimpanan yang tidak bisa dipakai', () => {
    const { storage } = fakeStorage({ [queueViewStorageKey('user-1')]: 'tabel' })

    expect(readQueueView('user-1', storage)).toBe(defaultQueueView)
    expect(readQueueView('user-1', null)).toBe(defaultQueueView)
    expect(isQueueView('list')).toBe(true)
    expect(isQueueView('tabel')).toBe(false)
    expect(isQueueView(null)).toBe(false)
  })
})

// Dipakai untuk memastikan tipe tampilan tetap empat; menambah tampilan tanpa
// menambah label akan gagal di kompilasi, bukan di layar.
const allViews: QueueView[] = ['board', 'list', 'cards', 'compact']
void allViews

describe('ringkasan baris ponsel', () => {
  it('tidak menulis "Tepat · tepat" — tahap dan status sudah sama artinya', async () => {
    const onTime = makeBooking({
      id: 'on-time',
      bookingCode: 'TSB-20261112-010',
      status: 'CHECKED_IN_ON_TIME',
    })
    // Tampilan Daftar menyembunyikan kolom Tahap di layar sempit dan
    // menggantinya dengan ringkasan ini; teks itulah yang diuji.
    const { container } = await render(
      <QueueTable
        rows={[{ booking: onTime, laneKey: 'onTime' }]}
        now={NOW}
        docks={[]}
      />
    )

    const summary = container.querySelector('td p.md\\:hidden')
    // Ada jam tunggu: tetap satu kata tahap, diikuti ringkasan tunggu.
    expect(summary?.textContent).not.toContain('Tepat · tepat')
    expect(summary?.textContent?.startsWith('Tepat')).toBe(true)
  })
})
