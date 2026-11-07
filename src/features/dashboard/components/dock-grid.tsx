import { Link } from '@tanstack/react-router'
import { MoreHorizontal, Truck } from 'lucide-react'
import type { DockWithBooking } from '@/lib/api/types'
import { formatTime } from '@/lib/format'
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
  const total = booking.truckType.durationMinutes || 60
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
      <CardContent className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {docks.map((dock) => {
          const booking = dock.currentBooking
          const progress = progressOf(dock)
          return (
            <div
              key={dock.id}
              className={cn(
                'flex flex-col gap-3 rounded-lg border p-3.5 transition-colors',
                ring[dock.currentStatus]
              )}
            >
              <div className='flex items-start justify-between gap-2'>
                <div className='flex items-center gap-2'>
                  <span className='flex size-9 items-center justify-center rounded-md bg-background text-sm font-semibold tabular-nums shadow-xs'>
                    {dock.dockCode}
                  </span>
                  <div className='flex flex-col'>
                    <span className='text-sm font-semibold'>{dock.dockCode}</span>
                    <span className='text-xs text-muted-foreground'>
                      {activityLabel[dock.allowedActivity]}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-1'>
                  <Badge variant='outline' className={statusClass[dock.currentStatus]}>
                    {statusLabel[dock.currentStatus]}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='icon' className='size-8'>
                        <MoreHorizontal className='size-4' />
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
              </div>

              {!booking ? (
                <div className='flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-background/60 px-3 text-center'>
                  <Truck className='size-4 text-muted-foreground' />
                  <span className='text-xs text-muted-foreground'>
                    {dock.currentStatus === 'MAINTENANCE'
                      ? 'Dock sedang dalam perawatan'
                      : 'Kosong — siap truk berikutnya'}
                  </span>
                </div>
              ) : (
                <div className='space-y-2'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='font-mono text-sm font-semibold tabular-nums'>
                      {booking.licensePlate ?? 'Plat belum diisi'}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {booking.truckType.truckName}
                    </span>
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {booking.driverName ?? 'Supir belum diisi'} ·{' '}
                    {booking.customer.companyName ?? booking.customer.name}
                  </div>
                  {booking.status === 'IN_PROGRESS' ? (
                    <div className='space-y-1.5'>
                      <div
                        className='h-1.5 w-full overflow-hidden rounded-full bg-primary/15'
                        role='progressbar'
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
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
                    <div className='text-xs text-muted-foreground'>
                      Menunggu proses dimulai
                    </div>
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
