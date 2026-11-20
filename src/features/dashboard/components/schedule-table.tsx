import { Link } from '@tanstack/react-router'
import { CalendarClock, Download, Plus } from 'lucide-react'
import type { Booking } from '@/lib/api/types'
import { activityLabels, formatDate, formatTime } from '@/lib/format'
import { reportExportUrl } from '@/lib/api/endpoints'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
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
import { StatusBadge } from '@/components/status-badge'

/**
 * Jadwal satu hari. Baris yang sudah gate-in tetapi belum punya dock diberi
 * tombol assign, karena itulah aksi yang dibutuhkan admin saat itu.
 *
 * Di layar kecil kolom Slot, Customer, Aktivitas, dan Dock disembunyikan agar
 * tabel tidak memaksa geser horizontal; slot tetap terbaca sebagai baris kedua
 * di bawah plat nomor.
 */
export function ScheduleTable({
  date,
  rows,
  onAssign,
}: {
  date: string
  rows: Booking[]
  onAssign?: (booking: Booking) => void
}) {
  const t = useT()

  return (
    <Card className='gap-4'>
      <CardHeader className='flex-row items-start justify-between gap-3 space-y-0'>
        <div className='min-w-0 space-y-1.5'>
          <CardTitle className='flex items-center gap-2'>
            <CalendarClock className='size-4 shrink-0 text-muted-foreground' />
            {t('dashboard.scheduleTitle')}
          </CardTitle>
          <CardDescription>
            {t('dashboard.scheduleDesc', {
              count: rows.length,
              date: formatDate(`${date}T00:00:00.000Z`),
            })}
          </CardDescription>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button variant='outline' size='sm' asChild>
            <a href={reportExportUrl(date, date)} aria-label={t('dashboard.exportAria')}>
              <Download className='size-3.5' />
              <span className='hidden sm:inline'>{t('dashboard.export')}</span>
            </a>
          </Button>
          <Button size='sm' asChild>
            <Link to='/queue' aria-label={t('dashboard.openQueue')}>
              <Plus className='size-3.5' />
              <span className='hidden sm:inline'>{t('dashboard.openQueue')}</span>
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className='px-0'>
        <div className='w-full overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='hidden ps-6 sm:table-cell'>
                  {t('dashboard.colSlot')}
                </TableHead>
                <TableHead className='ps-4 sm:ps-2'>{t('dashboard.colTruck')}</TableHead>
                <TableHead className='hidden 2xl:table-cell'>
                  {t('dashboard.colCustomer')}
                </TableHead>
                <TableHead className='hidden xl:table-cell'>
                  {t('dashboard.colActivity')}
                </TableHead>
                <TableHead className='hidden md:table-cell'>
                  {t('dashboard.colStatus')}
                </TableHead>
                <TableHead className='hidden md:table-cell'>{t('dashboard.colDock')}</TableHead>
                <TableHead className='pe-4 text-right sm:pe-6'>
                  {t('dashboard.colAction')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => {
                const needsDock =
                  booking.status === 'CHECKED_IN_ON_TIME' ||
                  booking.status === 'LATE_WAITING_LIST'
                return (
                  <TableRow key={booking.id}>
                    <TableCell className='hidden text-sm whitespace-nowrap tabular-nums text-muted-foreground sm:table-cell sm:ps-6'>
                      {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                    </TableCell>
                    <TableCell className='ps-4 sm:ps-2'>
                      <div className='font-mono text-sm font-medium'>
                        {booking.licensePlate ?? booking.bookingCode}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {booking.driverName ?? t('dashboard.driverEmpty')}
                      </div>
                      <div className='text-xs tabular-nums text-muted-foreground sm:hidden'>
                        {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                      </div>
                      <div className='pt-1 md:hidden'>
                        <StatusBadge status={booking.status} />
                      </div>
                    </TableCell>
                    <TableCell className='hidden text-sm 2xl:table-cell'>
                      {booking.customer.name}
                    </TableCell>
                    <TableCell className='hidden xl:table-cell'>
                      <div className='text-sm'>{activityLabels[booking.activityType]}</div>
                      <div className='text-xs text-muted-foreground'>
                        {booking.truckType.truckName}
                      </div>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      <StatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell className='hidden text-sm md:table-cell'>
                      {booking.assignedDock ? (
                        <Badge variant='secondary' className='font-normal'>
                          {booking.assignedDock.dockCode}
                        </Badge>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell className='pe-4 text-right sm:pe-6'>
                      {needsDock ? (
                        onAssign ? (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => onAssign(booking)}
                          >
                            {t('dashboard.assign')}
                          </Button>
                        ) : (
                          <Button size='sm' variant='outline' asChild>
                            <Link to='/queue'>{t('dashboard.assign')}</Link>
                          </Button>
                        )
                      ) : (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-muted-foreground'
                          asChild
                        >
                          {/* Link router, bukan <a href>: tautan biasa memuat
                              ulang dokumen, dan riwayat SPA ikut hilang sehingga
                              tombol kembali di bilah atas mobile tidak muncul. */}
                          <Link to='/bookings/$bookingId' params={{ bookingId: booking.id }}>
                            {t('dashboard.detail')}
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className='h-24 text-center text-sm text-muted-foreground'
                  >
                    {t('dashboard.scheduleEmpty')}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
