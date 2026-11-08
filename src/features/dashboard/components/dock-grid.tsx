import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Truck } from 'lucide-react'
import type { DockWithBooking } from '@/lib/api/types'
import { bookingDurationMinutes, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ring: Record<string, string> = {
  AVAILABLE:
    'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/20',
  OCCUPIED:
    'border-blue-300/70 bg-blue-50/60 dark:border-blue-800/60 dark:bg-blue-950/20',
  MAINTENANCE: 'border-border bg-muted/40',
}

const activityLabel = {
  LOADING: 'Loading',
  UNLOADING: 'Unloading',
  BOTH: 'Loading & Unloading',
} as const

const statusLabel: Record<DockWithBooking['currentStatus'], string> = {
  AVAILABLE: 'Kosong',
  OCCUPIED: 'Terpakai',
  MAINTENANCE: 'Perawatan',
}

const statusClass: Record<DockWithBooking['currentStatus'], string> = {
  AVAILABLE: 'border-emerald-300 text-emerald-700 dark:text-emerald-300',
  OCCUPIED: 'border-blue-300 text-blue-700 dark:text-blue-300',
  MAINTENANCE: 'border-slate-300 text-slate-600 dark:text-slate-300',
}

/** Progres kasar proses bongkar/muat: menit berjalan dibagi durasi slot truk. */
function progressOf(dock: DockWithBooking) {
  const booking = dock.currentBooking
  if (!booking) return 0
  const startedAt = booking.timeLog?.processStartedAt
  if (!startedAt) return 0
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 60_000
  const total = bookingDurationMinutes(booking) || 60
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

export function DockGrid({ docks }: { docks: DockWithBooking[] }) {
  const occupied = docks.filter((dock) => dock.currentStatus === 'OCCUPIED').length
  const available = docks.filter((dock) => dock.currentStatus === 'AVAILABLE').length
  const maintenance = docks.filter((dock) => dock.currentStatus === 'MAINTENANCE').length

  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Monitoring Dock</CardTitle>
        <CardDescription>
          Status real-time · {docks.length} dock · {occupied} proses · {available} kosong
          {maintenance > 0 ? ` · ${maintenance} perawatan` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className='grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-3'>
        {docks.map((dock) => {
          const booking = dock.currentBooking
          const progress = progressOf(dock)
          return (
            <div
              key={dock.id}
              className={cn(
                'flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-lg border p-3 transition-colors',
                ring[dock.currentStatus]
              )}
            >
              <div className='flex items-center justify-between gap-1.5'>
                <span className='shrink-0 font-mono text-sm font-semibold tracking-tight'>
                  {dock.dockCode}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='-me-1.5 size-6'>
                      <MoreHorizontal className='size-3.5' />
                      <span className='sr-only'>Aksi {dock.dockCode}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuLabel>{dock.dockCode}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to='/queue'>Buka antrean</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to='/dock'>Layar checker</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className='flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1'>
                <span className='min-w-0 text-[11px] leading-tight text-muted-foreground'>
                  {activityLabel[dock.allowedActivity]}
                </span>
                <Badge
                  variant='outline'
                  className={cn('shrink-0 text-[11px]', statusClass[dock.currentStatus])}
                >
                  {statusLabel[dock.currentStatus]}
                </Badge>
              </div>

              {!booking ? (
                <div className='flex h-[76px] flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-background/60 px-2 text-center'>
                  <Truck className='size-3.5 text-muted-foreground' />
                  <span className='text-[11px] leading-snug text-muted-foreground'>
                    {dock.currentStatus === 'MAINTENANCE' ? 'Perawatan' : 'Siap dipakai'}
                  </span>
                </div>
              ) : (
                <div className='min-w-0 space-y-1.5'>
                  <div className='flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2'>
                    <span className='min-w-0 truncate font-mono text-sm font-semibold tabular-nums'>
                      {booking.licensePlate ?? 'Plat belum diisi'}
                    </span>
                    <span className='min-w-0 truncate text-xs text-muted-foreground'>
                      {booking.truckType.truckName}
                    </span>
                  </div>
                  <p className='truncate text-xs text-muted-foreground'>
                    {booking.driverName ?? 'Supir belum diisi'} ·{' '}
                    {booking.customer.name}
                  </p>
                  {booking.status === 'IN_PROGRESS' ? (
                    <div className='space-y-1 pt-0.5'>
                      <div
                        className='h-1.5 w-full overflow-hidden rounded-full bg-primary/15'
                        role='progressbar'
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progres proses ${dock.dockCode}`}
                      >
                        <div
                          className='h-full rounded-full bg-primary transition-[width] duration-300'
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className='flex justify-between text-xs text-muted-foreground'>
                        <span>
                          Mulai {formatTime(booking.timeLog?.processStartedAt ?? null)}
                        </span>
                        <span className='tabular-nums'>{progress}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className='text-xs text-muted-foreground'>Menunggu proses dimulai</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {docks.length === 0 ? (
          <p className='col-span-full py-6 text-center text-sm text-muted-foreground'>
            Belum ada dock. Tambahkan lewat Master Data.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
