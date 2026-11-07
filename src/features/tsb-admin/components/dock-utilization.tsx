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
import { Download } from 'lucide-react'

const rows = [
  { dock: 'Dock 1', activity: 'Unloading', truk: 9, jam: '6,8', util: 85, avg: '02:08' },
  { dock: 'Dock 2', activity: 'Unloading', truk: 8, jam: '6,1', util: 76, avg: '02:21' },
  { dock: 'Dock 3', activity: 'Unloading', truk: 7, jam: '5,2', util: 65, avg: '02:02' },
  { dock: 'Dock 4', activity: 'Unloading', truk: 6, jam: '4,4', util: 55, avg: '01:58' },
  { dock: 'Dock 5', activity: 'Loading', truk: 7, jam: '5,9', util: 74, avg: '02:30' },
  { dock: 'Dock 6', activity: 'Loading', truk: 5, jam: '3,8', util: 48, avg: '02:12' },
]

export function DockUtilization() {
  return (
    <Card className='gap-4'>
      <CardHeader className='flex-row items-start justify-between gap-3 space-y-0'>
        <div className='space-y-1.5'>
          <CardTitle>Utilisasi Dock</CardTitle>
          <CardDescription>
            Rekap hari ini · 42 truk · rata-rata utilisasi 67%
          </CardDescription>
        </div>
        <Button variant='outline' size='sm' className='shrink-0'>
          <Download className='size-3.5' />
          Excel
        </Button>
      </CardHeader>
      <CardContent className='px-0'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='ps-6'>Dock</TableHead>
              <TableHead>Aktivitas</TableHead>
              <TableHead className='text-right'>Truk</TableHead>
              <TableHead className='text-right'>Jam pakai (jam)</TableHead>
              <TableHead className='text-right'>Rata-rata proses</TableHead>
              <TableHead className='pe-6 text-right'>Utilisasi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.dock}>
                <TableCell className='ps-6 font-medium'>{row.dock}</TableCell>
                <TableCell className='text-muted-foreground'>{row.activity}</TableCell>
                <TableCell className='text-right tabular-nums'>{row.truk}</TableCell>
                <TableCell className='text-right tabular-nums'>{row.jam}</TableCell>
                <TableCell className='text-right tabular-nums'>{row.avg}</TableCell>
                <TableCell className='pe-6 text-right'>
                  <Badge
                    variant='outline'
                    className={
                      row.util >= 75
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : row.util >= 60
                          ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                          : 'border-border bg-muted text-muted-foreground'
                    }
                  >
                    {row.util}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
