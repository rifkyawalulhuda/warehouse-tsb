import { QueueCard } from './queue-card'
import type { QueueRow } from './queue-model'
import type { QueueActionHandlers } from './queue-table'

/**
 * Tampilan Kartu: kartu truk yang sama dengan papan, tetapi tanpa empat kolom.
 * Dipakai saat checker bekerja satu truk pada satu waktu dan tidak ingin
 * keempat lane menyempitkan kartunya.
 *
 * Urutannya tetap mengikuti tahap, jadi kartu terlambat selalu di depan.
 */
export function QueueGrid({
  rows,
  now,
  ...handlers
}: QueueActionHandlers & { rows: QueueRow[]; now: Date }) {
  return (
    <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      {rows.map(({ booking, laneKey }) => (
        <li key={booking.id}>
          <QueueCard
            booking={booking}
            laneKey={laneKey}
            now={now}
            {...handlers}
          />
        </li>
      ))}
    </ul>
  )
}
