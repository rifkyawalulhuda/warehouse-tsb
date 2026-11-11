import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fetchGateHistory } from '@/lib/api/endpoints'
import { GateHistoryPage } from '.'

vi.mock('@/lib/api/endpoints', () => ({ fetchGateHistory: vi.fn() }))
// Halaman ini hanya ingin memuat ulang saat ada perubahan realtime; socket dan
// providernya tidak relevan untuk tes tampilan.
vi.mock('@/hooks/use-realtime', () => ({ useRealtimeSync: () => undefined }))

const fetchMock = vi.mocked(fetchGateHistory)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <GateHistoryPage />
    </QueryClientProvider>
  )
}

const today = new Date().toISOString().slice(0, 10)

describe('halaman riwayat gate', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('menampilkan masuk dan keluar beserta keterangannya', async () => {
    fetchMock.mockResolvedValue({
      from: today,
      to: today,
      truncated: false,
      rows: [
        {
          id: 'out:1',
          event: 'GATE_OUT',
          at: `${today}T04:00:00.000Z`,
          bookingCode: 'T-ABC123',
          customer: 'PT Alpha Logistik',
          licensePlate: 'B 1234 TSB',
          driverName: 'Supir Satu',
          activityType: 'UNLOADING',
          dockCode: 'DOCK-01',
          gateInAt: `${today}T02:00:00.000Z`,
          gateOutAt: `${today}T04:00:00.000Z`,
          minutesInside: 120,
          officerName: 'Gate Tes',
          officerRole: 'GATE_OFFICER',
        },
      ],
    })

    const { getByText, getByRole } = await renderPage()

    await expect.element(getByText('120 menit di dalam')).toBeInTheDocument()
    await expect
      .element(getByRole('cell', { name: 'T-ABC123' }))
      .toBeInTheDocument()
    await expect.element(getByText('PT Alpha Logistik')).toBeInTheDocument()
  })

  it('menjelaskan keadaan kosong, bukan tabel kosong', async () => {
    fetchMock.mockResolvedValue({
      from: today,
      to: today,
      truncated: false,
      rows: [],
    })

    const { getByText } = await renderPage()

    await expect
      .element(getByText('Belum ada aktivitas gate'))
      .toBeInTheDocument()
  })

  it('memperingatkan saat daftar dipotong batas baris', async () => {
    fetchMock.mockResolvedValue({
      from: today,
      to: today,
      truncated: true,
      rows: [],
    })

    const { getByText } = await renderPage()

    await expect
      .element(getByText(/Menampilkan 0 peristiwa terbaru/))
      .toBeInTheDocument()
  })
})
