import { CalendarClock, Download, Plus } from 'lucide-react'
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
import { schedule } from '../data'
import { StatusBadge } from './status-badge'

export function ScheduleTable() {
  return (
    <Card className='gap-4'>
      <CardHeader className='flex-row items-start justify-between gap-3 space-y-0'>
        <div className='space-y-1.5'>
          <CardTitle className='flex items-center gap-2'>
            <CalendarClock className='size-4 text-muted-foreground' />
            Jadwal Hari Ini
          </CardTitle>
          <CardDescription>
            42 booking · 6 dock · Kamis, 11 Juni 2026
          </CardDescription>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button variant='outline' size='sm'>
            <Download className='size-3.5' />
            Export
          </Button>
          <Button size='sm'>
            <Plus className='size-3.5' />
            Walk-in
          </Button>
        </div>
      </CardHeader>
      <CardContent className='px-0'>
        <div className='w-full overflow-x-auto'>
        <Table className='min-w-[640px]'>
          <TableHeader>
            <TableRow>
              <TableHead className='ps-6'>Slot</TableHead>
              <TableHead>Truk</TableHead>
              <TableHead className='hidden 2xl:table-cell'>Customer</TableHead>
              <TableHead className='hidden xl:table-cell'>Aktivitas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='hidden lg:table-cell'>Dock</TableHead>
              <TableHead className='pe-6 text-right'>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((row) => (
              <TableRow key={row.plate + row.time}>
                <TableCell className='ps-6 text-sm whitespace-nowrap tabular-nums text-muted-foreground'>
                  {row.time}
                </TableCell>
                <TableCell>
                  <div className='font-mono text-sm font-medium'>{row.plate}</div>
                  <div className='text-xs text-muted-foreground'>{row.driver}</div>
                </TableCell>
                <TableCell className='hidden text-sm 2xl:table-cell'>
                  {row.customer}
                </TableCell>
                <TableCell className='hidden xl:table-cell'>
                  <div className='text-sm'>{row.activity}</div>
                  <div className='text-xs text-muted-foreground'>{row.truck}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className='hidden text-sm lg:table-cell'>
                  {row.dock === '—' ? (
                    <span className='text-muted-foreground'>—</span>
                  ) : (
                    <Badge variant='secondary' className='font-normal'>
                      {row.dock}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className='pe-6 text-right'>
                  {row.status === 'checked-in' || row.status === 'terlambat' ? (
                    <Button size='sm' variant='outline'>
                      Assign dock
                    </Button>
                  ) : (
                    <Button size='sm' variant='ghost' className='text-muted-foreground'>
                      Detail
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  )
}
