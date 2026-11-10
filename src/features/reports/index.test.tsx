import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { fetchCustomerOptions, fetchKpi } from '@/lib/api/endpoints'
import type { ReportResponse } from '@/lib/api/types'
import { addDaysISO, todayISO } from '@/lib/format'
import { ReportsPage } from '.'

vi.mock('@/lib/api/endpoints', () => ({
  fetchCustomerOptions: vi.fn(),
  fetchKpi: vi.fn(),
  reportExportUrl: (from: string, to: string, customerId?: string) =>
    `/api/reports/export.xlsx?from=${from}&to=${to}${
      customerId ? `&customerId=${customerId}` : ''
    }`,
}))
vi.mock('@/hooks/use-realtime', () => ({ useRealtimeSync: () => undefined }))

const kpiMock = vi.mocked(fetchKpi)
const customersMock = vi.mocked(fetchCustomerOptions)

const today = todayISO()
const defaultFrom = addDaysISO(today, -6)

const report: ReportResponse = {
  from: defaultFrom,
  to: today,
  kpi: {
    totalBookings: 4,
    completed: 3,
    cancelled: 0,
    noShow: 0,
    expiredPending: 1,
    onTimeRate: 75,
    averageWaitingMinutes: 10,
    averageProcessingMinutes: 20,
    averageTurnaroundMinutes: 30,
    averageLateMinutes: 0,
  },
  rows: [],
  byDay: [],
  byActivity: [],
  byDock: [],
  arrivalsByHour: [],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsPage />
    </QueryClientProvider>
  )
}

describe('filter halaman laporan', () => {
  beforeEach(() => {
    kpiMock.mockReset()
    customersMock.mockReset()
    kpiMock.mockResolvedValue(report)
    customersMock.mockResolvedValue([])
  })

  it('memberi label yang jelas pada setiap kontrol filter', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByLabelText('Dari tanggal'))
      .toBeInTheDocument()
    await expect
      .element(screen.getByLabelText('Sampai tanggal'))
      .toBeInTheDocument()
    await expect.element(screen.getByLabelText('Customer')).toBeInTheDocument()
  })

  it('memilih rentang tujuh hari terakhir secara bawaan', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByRole('button', { name: '7 hari' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect
      .element(screen.getByRole('button', { name: '30 hari' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('mengganti rentang lewat pintasan tanpa membuka kalender', async () => {
    const screen = await renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }))

    await expect
      .element(screen.getByRole('button', { name: 'Hari ini' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(kpiMock).toHaveBeenLastCalledWith(today, today, undefined)
  })

  it('menonaktifkan ekspor selama data rentang terpilih belum ada', async () => {
    kpiMock.mockReturnValue(new Promise(() => undefined))

    const screen = await renderPage()

    await expect
      .element(screen.getByRole('button', { name: /Ekspor Excel/ }))
      .toBeDisabled()
  })

  it('mengaktifkan ekspor setelah data tersedia', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByRole('link', { name: /Ekspor Excel/ }))
      .toHaveAttribute('href', expect.stringContaining('from='))
  })

  it('mengembalikan semua filter ke keadaan awal lewat Atur ulang', async () => {
    const screen = await renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }))
    await userEvent.click(screen.getByRole('button', { name: 'Atur ulang' }))

    await expect
      .element(screen.getByRole('button', { name: '7 hari' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('menjelaskan saat daftar customer gagal dimuat', async () => {
    customersMock.mockRejectedValue(new Error('gagal'))

    const screen = await renderPage()

    await expect
      .element(screen.getByText('Daftar customer gagal dimuat.'))
      .toBeInTheDocument()
  })
})
