import '@/styles/index.css'
import { describe, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import type { Booking, DockWithBooking } from '@/lib/api/types'
import { QueueCard } from './queue-card'
import { QueueTable } from './queue-table'

const booking = {
  id: 'b1',
  bookingCode: 'TSB-20261126-001',
  qrToken: 't',
  activityType: 'UNLOADING',
  bookingDate: '2026-11-26',
  startTime: '2026-11-26T01:00:00.000Z',
  endTime: '2026-11-26T02:30:00.000Z',
  referenceDocNo: 'SJ-1',
  licensePlate: 'B 9012 MN',
  driverName: 'Sugiyanto',
  driverPhone: '0812',
  status: 'LATE_WAITING_LIST',
  lateMinutes: 0,
  blocksLocked: 3,
  processTypeId: 1,
  processName: 'Curah',
  processExtraMinutes: 30,
  approvalStatus: 'NOT_REQUIRED',
  customer: { id: 'c1', name: 'CV Mitra Niaga', code: 'MN', warehouseIds: [] },
  createdBy: { id: 'u1', name: 'Admin' },
  truckType: {
    id: 1,
    truckName: 'Tronton',
    durationMinutes: 60,
    blocksRequired: 2,
  },
  assignedDock: null,
  timeLog: { gateInAt: '2026-11-26T01:10:00.000Z' },
} as unknown as Booking

const docks: DockWithBooking[] = [
  {
    id: 1,
    dockCode: 'D1',
    areaName: 'Area A',
    allowedActivity: 'UNLOADING',
    currentStatus: 'AVAILABLE',
    warehouse: { id: 1, name: 'Gudang WH1' },
    activeBooking: null,
  } as unknown as DockWithBooking,
]

/**
 * Skrip tangkapan layar untuk meninjau tampilan antrean secara manual.
 *
 * Ini BUKAN tes: tidak ada satu pun assertion, dan satu-satunya hasilnya berkas
 * PNG di `__shots/`. Dulu ia ikut berjalan di setiap `npm test` sehingga
 * menghabiskan waktu peramban tanpa memeriksa apa pun. Jalankan dengan
 * `VITE_SHOTS=1` bila memang ingin melihat tangkapannya.
 */
const shots = import.meta.env.VITE_SHOTS === '1' ? describe : describe.skip

shots('tangkapan antrean', () => {
  it('kartu', async () => {
    const screen = await render(
      <div className='w-[320px] p-4'>
        <QueueCard
          booking={booking}
          laneKey='late'
          now={new Date('2026-11-26T01:40:00.000Z')}
          docks={docks}
          onQuickAssign={() => {}}
          onNoShow={() => {}}
        />
      </div>
    )
    await page.screenshot({ path: 'src/features/queue/__shots/queue-card.png' })
    void screen
  })

  it('tabel', async () => {
    await page.viewport(1280, 800)
    await render(
      <div className='w-[860px] p-4'>
        <QueueTable
          rows={[{ booking, laneKey: 'late' } as never]}
          now={new Date('2026-11-26T01:40:00.000Z')}
          docks={docks}
          onQuickAssign={() => {}}
          onNoShow={() => {}}
        />
      </div>
    )
    await page.screenshot({
      path: 'src/features/queue/__shots/queue-table.png',
    })
  })
})
