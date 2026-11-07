import { Download } from 'lucide-react'
import type { DockReport } from '@/lib/api/types'
import { activityLabels } from '@/lib/format'
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

/**
 * Utilisasi dock dalam rentang tanggal. Angka "jam pakai" berasal dari selisih
 * waktu proses yang tercatat, bukan dari durasi slot yang dipesan.
 */
export function DockUtilization({
  rows,
  rangeLabel,
  onExport,
}: {
  rows: DockReport[]
  rangeLabel: string
  onExport?: () => void
}) {
  const totalTrucks = rows.reduce((sum, row) => sum + row.trucks, 0)
  const averageUtilization =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, row) => sum + row.utilization, 0) / rows.length)

  return (
    <Card className='gap-4'>
      <CardHeader className='flex-row items-start justify-between gap-3 space-y-0'>
        <div className='space-y-1.5'>
          <CardTitle>Utilisasi Dock</CardTitle>
          <CardDescription>
            {rangeLabel} · {totalTrucks} truk · rata-rata utilisasi{' '}
            {averageUtilization}%
          </CardDescription>
        </div>
        {onExport ? (
          <Button variant='outline' size='sm' className='shrink-0' onClick={onExport}>
            <Download className='size-3.5' />
            Excel
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className='px-0'>
        <div className='w-full overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='ps-6'>Dock</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead className='text-right'>Truk</TableHead>
                <TableHead className='text-right'>Jam pakai</TableHead>
                <TableHead className='text-right'>Rata-rata proses</TableHead>
                <TableHead className='pe-6 text-right'>Utilisasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.dockCode}>
                  <TableCell className='ps-6 font-medium'>{row.dockCode}</TableCell>
                  <TableCell className='text-muted-foreground'>
                    {row.activity === 'BOTH'
                      ? 'Loading & Unloading'
                      : activityLabels[row.activity as 'LOADING' | 'UNLOADING']}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{row.trucks}</TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {row.usedHours.toFixed(1)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {row.averageProcessingMinutes} mnt
                  </TableCell>
                  <TableCell className='pe-6 text-right'>
                    <Badge
                      variant='outline'
                      className={
                        row.utilization >= 75
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : row.utilization >= 60
                            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'border-border bg-muted text-muted-foreground'
                      }
                    >
                      {row.utilization}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className='h-24 text-center text-sm text-muted-foreground'
                  >
                    Belum ada truk yang menempati dock pada rentang ini.
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
