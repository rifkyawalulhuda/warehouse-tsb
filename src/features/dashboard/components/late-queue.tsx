import { Link } from '@tanstack/react-router'
import { ArrowRight, Timer } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Antrean truk terlambat. Tetap dilayani, tetapi menunggu di belakang truk
 * on-time — jadi baris ini adalah daftar kerja berikutnya bagi checker.
 */
export function LateQueue({
  rows,
  onAssign,
}: {
  rows: Booking[]
  onAssign?: (booking: Booking) => void
}) {
  return (
    <Card className='gap-4 border-amber-200 dark:border-amber-900/60'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Timer className='size-4 text-amber-600 dark:text-amber-400' />
          Antrean Terlambat
        </CardTitle>
        <CardDescription>
          {rows.length} truk menunggu dock · dilayani setelah truk on-time
        </CardDescription>
      </CardHeader>
      <CardContent className='px-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='ps-6'>Truk</TableHead>
              <TableHead>Slot</TableHead>
              <TableHead className='text-right'>Telat</TableHead>
              <TableHead className='pe-6 text-right'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className='ps-6'>
                  <div className='font-mono text-sm font-medium'>
                    {booking.licensePlate ?? booking.bookingCode}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {booking.driverName ?? 'Supir belum diisi'} ·{' '}
                    {booking.truckType.truckName}
                  </div>
                </TableCell>
                <TableCell className='text-sm tabular-nums text-muted-foreground'>
                  {formatTime(booking.startTime)}
                </TableCell>
                <TableCell className='text-right'>
                  <span className='inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'>
                    +{booking.lateMinutes} mnt
                  </span>
                </TableCell>
                <TableCell className='pe-6 text-right'>
                  {onAssign ? (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => onAssign(booking)}
                    >
                      Assign
                      <ArrowRight className='size-3.5' />
                    </Button>
                  ) : (
                    <Button size='sm' variant='outline' asChild>
                      <Link to='/queue'>
                        Antrean
                        <ArrowRight className='size-3.5' />
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='h-24 text-center text-sm text-muted-foreground'
                >
                  Tidak ada truk terlambat. Semua armada datang sesuai slot.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
