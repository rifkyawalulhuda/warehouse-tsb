import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fetchCheckerScan } from '@/lib/api/endpoints'
import type { CheckerScanResult } from '@/lib/api/types'
import { CheckerScanPage } from '.'

vi.mock('@/lib/api/endpoints', () => ({
  fetchCheckerScan: vi.fn(),
  assignDock: vi.fn(),
  startProcess: vi.fn(),
  finishProcess: vi.fn(),
}))
vi.mock('@/hooks/use-realtime', () => ({ useRealtimeSync: () => undefined }))
/**
 * Kamera tidak bisa dipakai di tes, jadi pemindai diganti tombol yang
 * mengirim token yang sama seperti hasil pindai sungguhan.
 */
vi.mock('@/features/scanner/qr-scanner', () => ({
  QrScanner: ({ onScan }: { onScan: (token: string) => void }) => (
    <button type='button' onClick={() => onScan('qr-token')}>
      Pindai tes
    </button>
  ),
}))

const fetchMock = vi.mocked(fetchCheckerScan)

function result(overrides: {
  status: CheckerScanResult['booking']['status']
  actions: CheckerScanResult['actions']
  approvalStatus?: 'PENDING' | 'APPROVED'
  dockCode?: string
}): CheckerScanResult {
  return {
    booking: {
      id: 'b1',
      bookingCode: 'T-ABC123',
      qrToken: 'qr-token',
      activityType: 'UNLOADING',
      bookingDate: '2026-11-10',
      startTime: '2026-11-10T09:00:00.000Z',
      endTime: '2026-11-10T10:00:00.000Z',
      status: overrides.status,
      approvalStatus: overrides.approvalStatus ?? 'APPROVED',
      licensePlate: 'B 1234 TSB',
      driverName: 'Supir Tes',
      customer: { id: 'c1', name: 'PT Alpha Logistik', code: 'CUST-001' },
      truckType: {
        id: 1,
        truckName: 'CDD',
        durationMinutes: 60,
        blocksRequired: 2,
      },
      assignedDock: overrides.dockCode
        ? { id: 1, dockCode: overrides.dockCode, allowedActivity: 'UNLOADING' }
        : null,
      timeLog: { gateInAt: '2026-11-10T08:45:00.000Z' },
    } as CheckerScanResult['booking'],
    waitingPosition: overrides.actions.assignDock ? 2 : null,
    waitingSince: overrides.actions.assignDock
      ? '2026-11-10T08:45:00.000Z'
      : null,
    actions: overrides.actions,
    docks: [
      {
        id: 1,
        dockCode: 'D1',
        allowedActivity: 'UNLOADING',
        currentStatus: 'AVAILABLE',
        eligible: true,
      },
      {
        id: 2,
        dockCode: 'D2',
        allowedActivity: 'LOADING',
        currentStatus: 'AVAILABLE',
        eligible: false,
      },
      {
        id: 3,
        dockCode: 'D3',
        allowedActivity: 'BOTH',
        currentStatus: 'OCCUPIED',
        eligible: false,
      },
    ],
  }
}

/** Memindai satu tiket lalu menunggu kartu hasilnya muncul. */
async function openTicket(data: CheckerScanResult) {
  fetchMock.mockResolvedValue(data)
  const screen = await render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CheckerScanPage />
    </QueryClientProvider>
  )

  await screen.getByRole('button', { name: 'Pindai tes' }).click()
  await expect.element(screen.getByText('T-ABC123')).toBeInTheDocument()

  return screen
}

describe('halaman pindai checker', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('menawarkan dock kosong yang cocok untuk truk yang menunggu', async () => {
    const { getByText, getByRole } = await openTicket(
      result({
        status: 'CHECKED_IN_ON_TIME',
        actions: { assignDock: true, start: false, finish: false },
      })
    )

    await expect
      .element(getByText('Ke-2 dari truk yang menunggu'))
      .toBeInTheDocument()
    await expect.element(getByRole('radio', { name: 'D1' })).toBeInTheDocument()
    await expect
      .element(getByRole('button', { name: /Tugaskan & mulai proses/ }))
      .toBeDisabled()
    await expect
      .element(getByText(/D2 \(aktivitas berbeda\)/))
      .toBeInTheDocument()
    await expect.element(getByText(/D3 \(terpakai\)/)).toBeInTheDocument()
  })

  it('memilih dock mengaktifkan tombol tugaskan', async () => {
    const { getByRole } = await openTicket(
      result({
        status: 'CHECKED_IN_ON_TIME',
        actions: { assignDock: true, start: false, finish: false },
      })
    )

    const radio = getByRole('radio', { name: 'D1' })
    await expect.element(radio).toBeInTheDocument()
    await radio.click()

    await expect
      .element(getByRole('button', { name: /Tugaskan & mulai proses/ }))
      .toBeEnabled()
  })

  it('menampilkan tombol mulai untuk truk yang sudah ditugaskan', async () => {
    const { getByRole } = await openTicket(
      result({
        status: 'DOCK_ASSIGNED',
        dockCode: 'D1',
        actions: { assignDock: false, start: true, finish: false },
      })
    )

    await expect
      .element(getByRole('button', { name: /Mulai proses/ }))
      .toBeInTheDocument()
    expect(
      getByRole('button', { name: /Selesaikan proses/ }).elements()
    ).toHaveLength(0)
  })

  it('menampilkan tombol selesai untuk truk yang sedang diproses', async () => {
    const { getByRole } = await openTicket(
      result({
        status: 'IN_PROGRESS',
        dockCode: 'D1',
        actions: { assignDock: false, start: false, finish: true },
      })
    )

    await expect
      .element(getByRole('button', { name: /Selesaikan proses/ }))
      .toBeInTheDocument()
  })

  it('mengarahkan ke gate untuk truk yang belum check-in', async () => {
    const { getByText, getByRole } = await openTicket(
      result({
        status: 'BOOKED_READY',
        actions: { assignDock: false, start: false, finish: false },
      })
    )

    await expect
      .element(getByText('Truk belum check-in di gate'))
      .toBeInTheDocument()
    expect(
      getByRole('button', { name: /Tugaskan & mulai proses/ }).elements()
    ).toHaveLength(0)
  })

  it('menahan aksi selama booking belum disetujui', async () => {
    const { getByText } = await openTicket(
      result({
        status: 'CHECKED_IN_ON_TIME',
        approvalStatus: 'PENDING',
        actions: { assignDock: false, start: false, finish: false },
      })
    )

    await expect
      .element(getByText('Menunggu persetujuan Admin'))
      .toBeInTheDocument()
  })
})
