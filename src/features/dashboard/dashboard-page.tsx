import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarDays, Download, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchActivity,
  fetchKpi,
  fetchOpsDocks,
  fetchQueue,
  fetchSettings,
} from '@/lib/api/endpoints'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { addDaysISO, formatDate, todayISO } from '@/lib/format'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityFeed } from './components/activity-feed'
import { ArrivalChart, TurnaroundChart } from './components/charts'
import { DockGrid } from './components/dock-grid'
import { DockUtilization } from './components/dock-utilization'
import { KpiCards, type KpiItem } from './components/kpi-cards'
import { LateQueue } from './components/late-queue'
import { ScheduleTable } from './components/schedule-table'

function LiveDot() {
  return (
    <span className='relative flex size-2'>
      <span className='absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none' />
      <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
    </span>
  )
}

export function DashboardPage() {
  useRealtimeSync()
  const navigate = useNavigate()

  const date = todayISO()
  const weekStart = addDaysISO(date, -6)

  const queue = useQuery({
    queryKey: ['ops', 'queue', date],
    queryFn: () => fetchQueue(date),
  })
  const docks = useQuery({ queryKey: ['ops', 'docks'], queryFn: fetchOpsDocks })
  const activity = useQuery({
    queryKey: ['ops', 'activity'],
    queryFn: () => fetchActivity(14),
  })
  const today = useQuery({
    queryKey: ['reports', date, date],
    queryFn: () => fetchKpi(date, date),
  })
  const week = useQuery({
    queryKey: ['reports', weekStart, date],
    queryFn: () => fetchKpi(weekStart, date),
  })
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  const busyDocks = docks.data?.filter((dock) => dock.currentStatus === 'OCCUPIED').length ?? 0
  const totalDocks = docks.data?.length ?? 0
  const lateCount = queue.data?.late.length ?? 0
  const atDockCount = queue.data?.atDock.length ?? 0

  const schedule = queue.data
    ? [...queue.data.atDock, ...queue.data.onTime, ...queue.data.late, ...queue.data.upcoming]
    : []

  const kpi = today.data?.kpi
  const dailyCapacity =
    settings.data?.blocksPerDay != null && settings.data.capacity
      ? settings.data.blocksPerDay *
        (settings.data.capacity.UNLOADING + settings.data.capacity.LOADING)
      : null
  const dockUtilization =
    today.data && today.data.byDock.length > 0
      ? Math.round(
          today.data.byDock.reduce((sum, dock) => sum + dock.utilization, 0) /
            today.data.byDock.length
        )
      : 0

  const kpiItems: KpiItem[] = [
    {
      label: 'Truk hari ini',
      value: kpi?.totalBookings ?? '-',
      unit: 'booking',
      delta: `${atDockCount} sedang di dock`,
      trend: 'flat',
      hint: dailyCapacity ? `Kapasitas ${dailyCapacity} slot dock` : 'Seluruh booking hari ini',
      icon: 'truck',
    },
    {
      label: 'On-time arrival',
      value: kpi ? kpi.onTimeRate : '-',
      unit: kpi ? '%' : undefined,
      delta: lateCount > 0 ? `${lateCount} truk terlambat` : 'Tidak ada yang terlambat',
      trend: lateCount > 0 ? 'down' : 'up',
      hint: 'Dari truk yang sudah gate-in',
      icon: 'clock',
    },
    {
      label: 'Utilisasi dock',
      value: today.data ? dockUtilization : '-',
      unit: today.data ? '%' : undefined,
      delta: `${busyDocks}/${totalDocks} dock terpakai`,
      trend: 'flat',
      hint: 'Jam proses vs jam operasional',
      icon: 'gauge',
    },
    {
      label: 'Rata-rata turnaround',
      value: kpi ? kpi.averageTurnaroundMinutes : '-',
      unit: kpi ? 'mnt' : undefined,
      delta: kpi ? `tunggu ${kpi.averageWaitingMinutes} mnt` : 'Belum ada data',
      trend: 'flat',
      hint: 'Gate-in sampai gate-out',
      icon: 'timer',
    },
  ]

  const goToQueue = () => {
    void navigate({ to: '/queue' })
  }

  const isBusy = queue.isPending || docks.isPending
  const isRefreshing =
    !isBusy &&
    (queue.isFetching ||
      docks.isFetching ||
      activity.isFetching ||
      today.isFetching ||
      week.isFetching)

  const refreshAll = () => {
    void queue.refetch()
    void docks.refetch()
    void activity.refetch()
    void today.refetch()
    void week.refetch()
  }

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <PageHeader
        title='Dashboard Operasional'
        description={`${formatDate(`${date}T00:00:00.000Z`)} · ${totalDocks} dock aktif · shift operasional`}
        actions={
          <>
            <Badge
              variant='outline'
              className='gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
            >
              <LiveDot />
              Live
            </Badge>
            <Button
              variant='outline'
              size='icon'
              className='size-9'
              onClick={refreshAll}
              disabled={isRefreshing}
              aria-label='Muat ulang data dashboard'
              title='Muat ulang'
            >
              <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            <Button variant='outline' size='sm' className='h-9' asChild>
              <Link to='/reports'>
                <Download className='size-4' />
                <span className='hidden sm:inline'>Laporan</span>
              </Link>
            </Button>
            <Button size='sm' className='h-9' asChild>
              <Link to='/queue'>
                <CalendarDays className='size-4' />
                Buka antrean
              </Link>
            </Button>
          </>
        }
      />

      {isBusy ? (
        <LoadingBlock label='Memuat dashboard...' />
      ) : queue.isError || docks.isError ? (
        <ErrorBlock
          error={queue.error ?? docks.error}
          onRetry={() => {
            void queue.refetch()
            void docks.refetch()
          }}
        />
      ) : (
        <Tabs defaultValue='ringkasan' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='ringkasan'>Ringkasan</TabsTrigger>
            <TabsTrigger value='dock'>Monitoring dock</TabsTrigger>
            <TabsTrigger value='laporan'>Laporan &amp; KPI</TabsTrigger>
          </TabsList>

          <TabsContent value='ringkasan' className='space-y-4'>
            <KpiCards items={kpiItems} />
            <div className='grid min-w-0 items-start gap-4 xl:grid-cols-7'>
              <div className='min-w-0 xl:col-span-4'>
                <DockGrid docks={docks.data ?? []} />
              </div>
              <div className='min-w-0 xl:col-span-3'>
                <LateQueue rows={queue.data?.late ?? []} onAssign={goToQueue} />
              </div>
            </div>
            <div className='grid min-w-0 items-start gap-4 xl:grid-cols-7'>
              <div className='min-w-0 xl:col-span-4'>
                <ScheduleTable date={date} rows={schedule} onAssign={goToQueue} />
              </div>
              <div className='min-w-0 xl:col-span-3'>
                <ActivityFeed items={activity.data ?? []} />
              </div>
            </div>
            {today.data ? (
              <div className='grid gap-4 xl:grid-cols-2'>
                <ArrivalChart data={today.data.arrivalsByHour} />
                <TurnaroundChart data={week.data?.byDay ?? today.data.byDay} />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value='dock' className='space-y-4'>
            <DockGrid docks={docks.data ?? []} />
            <div className='grid gap-4 xl:grid-cols-2'>
              <LateQueue rows={queue.data?.late ?? []} />
              {today.data ? (
                <DockUtilization
                  rows={today.data.byDock}
                  rangeLabel={`Hari ini · ${formatDate(`${date}T00:00:00.000Z`)}`}
                />
              ) : (
                <LoadingBlock label='Menghitung utilisasi...' />
              )}
            </div>
          </TabsContent>

          <TabsContent value='laporan' className='space-y-4'>
            <KpiCards items={kpiItems} />
            {today.data ? (
              <>
                <DockUtilization
                  rows={today.data.byDock}
                  rangeLabel={`Hari ini · ${formatDate(`${date}T00:00:00.000Z`)}`}
                />
                <div className='grid gap-4 xl:grid-cols-2'>
                  <ArrivalChart data={today.data.arrivalsByHour} />
                  <TurnaroundChart data={week.data?.byDay ?? today.data.byDay} />
                </div>
              </>
            ) : (
              <LoadingBlock label='Menghitung KPI...' />
            )}
          </TabsContent>
        </Tabs>
      )}
    </Main>
  )
}
