import { MoreHorizontal, Truck } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import { docks } from '../data'
import { StatusBadge } from './status-badge'

const ring: Record<string, string> = {
  kosong: 'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/20',
  proses: 'border-blue-300/70 bg-blue-50/60 dark:border-blue-800/60 dark:bg-blue-950/20',
  booking: 'border-violet-300/70 bg-violet-50/60 dark:border-violet-800/60 dark:bg-violet-950/20',
  selesai: 'border-border bg-muted/40',
}

export function DockGrid() {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle>Monitoring Dock</CardTitle>
        <CardDescription>
          Status real-time · 6 dock (4 unloading · 2 loading) · 2 proses · 1
          booking · 3 kosong
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {docks.map((dock) => (
          <div
            key={dock.id}
            className={cn(
              'flex flex-col gap-3 rounded-lg border p-3.5 transition-colors',
              ring[dock.status]
            )}
          >
            <div className='flex items-start justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <span className='flex size-9 items-center justify-center rounded-md bg-background text-sm font-semibold tabular-nums shadow-xs'>
                  {dock.id}
                </span>
                <div className='flex flex-col'>
                  <span className='text-sm font-semibold'>{dock.name}</span>
                  <span className='text-xs text-muted-foreground'>
                    {dock.activity}
                  </span>
                </div>
              </div>
              <div className='flex items-center gap-1'>
                <StatusBadge status={dock.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='size-8'>
                      <MoreHorizontal className='size-4' />
                      <span className='sr-only'>Aksi {dock.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuLabel>{dock.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Assign truk</DropdownMenuItem>
                    <DropdownMenuItem>Lihat riwayat dock</DropdownMenuItem>
                    <DropdownMenuItem>Tandai selesai</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant='destructive'>
                      Ubah jadi maintenance
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {dock.status === 'kosong' ? (
              <div className='flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed bg-background/60 px-3 text-center'>
                <Truck className='size-4 text-muted-foreground' />
                <span className='text-xs text-muted-foreground'>
                  Kosong — siap truk berikutnya
                </span>
                {dock.nextSlot ? (
                  <span className='text-[11px] text-muted-foreground/80'>
                    booking berikutnya {dock.nextSlot}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className='space-y-2'>
                <div className='flex items-baseline justify-between gap-2'>
                  <span className='font-mono text-sm font-semibold tabular-nums'>
                    {dock.plate}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    {dock.truck}
                  </span>
                </div>
                <div className='text-xs text-muted-foreground'>{dock.driver}</div>
                {dock.status === 'proses' ? (
                  <div className='space-y-1.5'>
                    <div
                      className='h-1.5 w-full overflow-hidden rounded-full bg-primary/15'
                      role='progressbar'
                      aria-valuenow={dock.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className='h-full rounded-full bg-primary transition-[width] duration-300'
                        style={{ width: `${dock.progress}%` }}
                      />
                    </div>
                    <div className='flex justify-between text-xs text-muted-foreground'>
                      <span>Mulai {dock.startedAt}</span>
                      <span className='tabular-nums'>{dock.progress}%</span>
                    </div>
                  </div>
                ) : (
                  <div className='text-xs text-muted-foreground'>
                    Slot berikutnya {dock.nextSlot}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
