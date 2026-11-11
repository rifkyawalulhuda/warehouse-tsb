import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { fetchMyReport } from '@/lib/api/endpoints'
import type { CustomerReportResponse } from '@/lib/api/types'
import { addDaysISO, todayISO } from '@/lib/format'
import { CustomerReportsPage } from './customer'

vi.mock('@/lib/api/endpoints', () => ({
  fetchMyReport: vi.fn(),
  myReportExportUrl: (from: string, to: string) =>
    `/api/reports/my/export.xlsx?from=${from}&to=${to}`,
}))
vi.mock('@/hooks/use-realtime', () => ({ useRealtimeSync: () => undefined }))
// Tabel data hanya dirender di desktop; tes ini memeriksa tabel, bukan kartu.
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

const reportMock = vi.mocked(fetchMyReport)

const today = todayISO()
const defaultFrom = addDaysISO(today, -6)

const report: CustomerReportResponse = {
  from: defaultFrom,
  to: today,
  customer: { code: 'CUST-001', name: 'PT Alpha Logistik' },
  kpi: {
    totalBookings: 4,
    completed: 3,
    cancelled: 1,
    noShow: 0,
    expiredPending: 0,
    onTimeRate: 75,
    averageWaitingMinutes: 10,
    averageProcessingMinutes: 40,
    averageTurnaroundMinutes: 60,
    averageLateMinutes: 5,
    averageSlotUsedPercent: 90,
    overrunCount: 1,
  },
  rows: [],
  byDay: [],
  byHour: [],
  byActivity: [],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CustomerReportsPage />
    </QueryClientProvider>
  )
}

describe('halaman laporan customer', () => {
  beforeEach(() => {
    reportMock.mockReset()
    reportMock.mockResolvedValue(report)
  })

  it('tidak menawarkan pilihan customer karena laporan milik perusahaannya sendiri', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByText(/PT Alpha Logistik/))
      .toBeInTheDocument()
    // Tidak ada dropdown customer: hanya tanggal yang bisa diubah.
    await expect.element(screen.getByRole('combobox')).not.toBeInTheDocument()
  })

  it('memilih rentang tujuh hari terakhir secara bawaan', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByRole('button', { name: '7 hari' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('mengganti rentang lewat pintasan tanpa membuka kalender', async () => {
    const screen = await renderPage()

    await userEvent.click(screen.getByRole('button', { name: 'Hari ini' }))

    await expect
      .element(screen.getByRole('button', { name: 'Hari ini' }))
      .toHaveAttribute('aria-pressed', 'true')
    expect(reportMock).toHaveBeenLastCalledWith(today, today)
  })

  it('menonaktifkan ekspor selama data rentang terpilih belum ada', async () => {
    reportMock.mockReturnValue(new Promise(() => undefined))

    const screen = await renderPage()

    await expect
      .element(screen.getByRole('button', { name: /Ekspor Excel/ }))
      .toBeDisabled()
  })

  it('menautkan ekspor ke endpoint customer, bukan endpoint staf', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByRole('link', { name: /Ekspor Excel/ }))
      .toHaveAttribute(
        'href',
        expect.stringContaining('/reports/my/export.xlsx')
      )
  })

  it('menampilkan KPI tanpa angka kapasitas gudang', async () => {
    const screen = await renderPage()

    await expect
      .element(screen.getByText('Tingkat on-time'))
      .toBeInTheDocument()
    await expect.element(screen.getByText('75%')).toBeInTheDocument()
    await expect
      .element(screen.getByText('Pemakaian slot', { exact: true }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByText('Kapasitas slot', { exact: true }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByText(/Utilisasi dock/))
      .not.toBeInTheDocument()
  })
})
