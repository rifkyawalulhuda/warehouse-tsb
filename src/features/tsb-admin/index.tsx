import {
  CalendarDays,
  ChevronDown,
  RefreshCw,
  Warehouse,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ActivityFeed } from './components/activity-feed'
import { ArrivalChart, TurnaroundChart } from './components/charts'
import { DockGrid } from './components/dock-grid'
import { DockUtilization } from './components/dock-utilization'
import { KpiCards } from './components/kpi-cards'
import { LateQueue } from './components/late-queue'
import { ScheduleTable } from './components/schedule-table'

function LiveDot() {
  return (
    <span className='relative flex size-2'>
      <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75' />
      <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
    </span>
  )
}

export function TsbAdminDashboard() {
  return (
    <>
      <Header>
        <Select defaultValue='cikarang'>
          <SelectTrigger className='h-9 w-[190px]' size='sm'>
            <Warehouse className='size-4 text-muted-foreground' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='cikarang'>Gudang Cikarang</SelectItem>
            <SelectItem value='cibitung'>Gudang Cibitung</SelectItem>
            <SelectItem value='karawang'>Gudang Karawang</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue='today'>
          <SelectTrigger className='hidden h-9 w-[170px] sm:flex' size='sm'>
            <CalendarDays className='size-4 text-muted-foreground' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='today'>Hari ini · 11 Jun</SelectItem>
            <SelectItem value='tomorrow'>Besok · 12 Jun</SelectItem>
            <SelectItem value='week'>7 hari terakhir</SelectItem>
          </SelectContent>
        </Select>

        <Button variant='outline' size='sm' className='gap-1.5'>
          <RefreshCw className='size-3.5' />
          <span className='hidden sm:inline'>Muat ulang</span>
        </Button>

        <div className='ms-auto flex items-center gap-2'>
          <Badge
            variant='outline'
            className='gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          >
            <LiveDot />
            Live · 12 detik lalu
          </Badge>
          <Separator orientation='vertical' className='h-6' />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-9 gap-2 px-2'>
                <Avatar className='size-7'>
                  <AvatarFallback className='text-[11px]'>RK</AvatarFallback>
                </Avatar>
                <span className='hidden text-sm font-medium md:inline'>
                  Rina Kusuma
                </span>
                <ChevronDown className='size-3.5 text-muted-foreground' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-52'>
              <DropdownMenuLabel>
                <div className='text-sm font-medium'>Rina Kusuma</div>
                <div className='text-xs font-normal text-muted-foreground'>
                  Admin Gudang · Shift 1
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profil &amp; akses</DropdownMenuItem>
              <DropdownMenuItem>Preferensi dashboard</DropdownMenuItem>
              <DropdownMenuItem>Log aktivitas saya</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive'>Keluar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Header>

      <Main>
        <div className='mb-5 flex flex-wrap items-end justify-between gap-3'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Dashboard Operasional
            </h1>
            <p className='text-sm text-muted-foreground'>
              Gudang Cikarang · Kamis, 11 Juni 2026 · shift 1 (08:00–17:00) ·
              6 dock aktif
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm'>
              Ekspor laporan
            </Button>
            <Button size='sm'>Buat walk-in</Button>
          </div>
        </div>

        <Tabs defaultValue='ringkasan' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='ringkasan'>Ringkasan</TabsTrigger>
            <TabsTrigger value='dock'>Monitoring dock</TabsTrigger>
            <TabsTrigger value='laporan'>Laporan &amp; KPI</TabsTrigger>
          </TabsList>

          <TabsContent value='ringkasan' className='space-y-4'>
            <KpiCards />
            <div className='grid items-start gap-4 xl:grid-cols-7'>
              <div className='xl:col-span-4'>
                <DockGrid />
              </div>
              <div className='xl:col-span-3'>
                <LateQueue />
              </div>
            </div>
            <div className='grid items-start gap-4 xl:grid-cols-7'>
              <div className='xl:col-span-4'>
                <ScheduleTable />
              </div>
              <div className='xl:col-span-3'>
                <ActivityFeed />
              </div>
            </div>
            <div className='grid gap-4 xl:grid-cols-2'>
              <ArrivalChart />
              <TurnaroundChart />
            </div>
          </TabsContent>

          <TabsContent value='dock' className='space-y-4'>
            <DockGrid />
            <div className='grid gap-4 xl:grid-cols-2'>
              <LateQueue />
              <DockUtilization />
            </div>
          </TabsContent>

          <TabsContent value='laporan' className='space-y-4'>
            <KpiCards />
            <DockUtilization />
            <div className='grid gap-4 xl:grid-cols-2'>
              <ArrivalChart />
              <TurnaroundChart />
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
