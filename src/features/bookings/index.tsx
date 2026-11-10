import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CalendarX2, Plus, Search } from 'lucide-react'
import { fetchMyBookings } from '@/lib/api/endpoints'
import type { Booking } from '@/lib/api/types'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { useNow } from '@/hooks/use-now'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  filterCounts,
  filtersFor,
  groupByDay,
  matchesFilter,
  pickNextBooking,
  readViewMode,
  saveViewMode,
  type BookingFilter,
  type BookingsView,
} from './booking-view'
import { BookingCard, BookingCardSkeleton } from './components/booking-card'
import { BookingRow } from './components/booking-row'
import { BookingSchedule } from './components/booking-schedule'
import { NextBookingCard } from './components/next-booking-card'
import { FilterChips, ViewSwitcher } from './components/view-switcher'

type Scope = 'active' | 'past'

// Referensi tetap supaya `data ?? EMPTY` tidak membuat array baru tiap render
// dan merusak memo di bawahnya.
const EMPTY_BOOKINGS: Booking[] = []

export function MyBookings() {
  const [scope, setScope] = useState<Scope>('active')
  const [view, setView] = useState<BookingsView>(() => readViewMode())
  const [filter, setFilter] = useState<BookingFilter>('all')
  const [search, setSearch] = useState('')
  const now = useNow()
  useRealtimeSync()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['bookings', 'my', scope],
    queryFn: () => fetchMyBookings(scope),
  })

  const bookings = data ?? EMPTY_BOOKINGS

  const changeView = (next: BookingsView) => {
    setView(next)
    saveViewMode(next)
  }

  const changeScope = (next: Scope) => {
    setScope(next)
    // Filter cepat hanya bermakna untuk booking yang belum selesai.
    setFilter('all')
  }

  const counts = useMemo(() => filterCounts(bookings), [bookings])

  const visible = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return bookings.filter((booking) => {
      if (!matchesFilter(booking, filter)) return false
      if (!keyword) return true
      return (
        booking.bookingCode.toLowerCase().includes(keyword) ||
        (booking.licensePlate ?? '').toLowerCase().includes(keyword) ||
        booking.referenceDocNo.toLowerCase().includes(keyword)
      )
    })
  }, [bookings, filter, search])

  const next = useMemo(
    () => (scope === 'active' ? pickNextBooking(bookings, now) : null),
    [bookings, now, scope]
  )

  // Blok "berikutnya" sudah memuat booking ini, jadi barisnya tidak diulang di
  // daftar — kecuali saat customer sedang memfilter/mencari, karena di situ
  // daftar harus utuh sesuai kata kunci.
  const listItems = useMemo(
    () => (next && filter === 'all' && !search.trim() ? visible.filter((b) => b.id !== next.id) : visible),
    [visible, next, filter, search]
  )

  const days = useMemo(() => groupByDay(listItems), [listItems])

  // Tampilan jadwal mengelompokkan per hari; tanggal di tiap baris daftar jadi
  // mubazir hanya jika semua booking ada di hari yang sama.
  const multiDay = useMemo(
    () => new Set(listItems.map((booking) => booking.bookingDate.slice(0, 10))).size > 1,
    [listItems]
  )

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Jadwal Saya'
        description='Semua booking truk yang Anda buat. Pilih tampilan yang paling nyaman.'
        actions={
          <Button asChild>
            <Link to='/bookings/new'>
              <Plus /> Booking Baru
            </Link>
          </Button>
        }
      />

      <Tabs value={scope} onValueChange={(value) => changeScope(value as Scope)}>
        <TabsList>
          <TabsTrigger value='active'>Aktif</TabsTrigger>
          <TabsTrigger value='past'>Riwayat</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <LoadingState view={view} />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : bookings.length === 0 ? (
        <EmptyState scope={scope} />
      ) : (
        <>
          {next && <NextBookingCard booking={next} now={now} />}

          <div className='flex flex-col gap-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <FilterChips
                value={filter}
                counts={counts}
                onChange={setFilter}
                only={filtersFor(scope)}
              />
              <ViewSwitcher value={view} onChange={changeView} />
            </div>

            {bookings.length > 3 && (
              <div className='relative'>
                <Search
                  className='pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground'
                  aria-hidden
                />
                <Input
                  type='search'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Cari kode booking, plat, atau nomor dokumen'
                  aria-label='Cari booking'
                  className='ps-8'
                />
              </div>
            )}
          </div>

          {listItems.length === 0 ? (
            <Card>
              <CardContent className='py-10 text-center text-sm text-muted-foreground'>
                Tidak ada booking yang cocok dengan filter atau kata kunci ini.
              </CardContent>
            </Card>
          ) : (
            <div
              key={view}
              className='animate-in duration-200 fade-in-0 slide-in-from-bottom-1'
            >
              {view === 'grid' && (
                <div className='grid gap-3 lg:grid-cols-2'>
                  {listItems.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} now={now} />
                  ))}
                </div>
              )}

              {view === 'list' && (
                <ul className='divide-y overflow-hidden rounded-xl border bg-card'>
                  {listItems.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      now={now}
                      showDate={multiDay}
                    />
                  ))}
                </ul>
              )}

              {view === 'schedule' && <BookingSchedule days={days} now={now} />}
            </div>
          )}
        </>
      )}
    </Main>
  )
}

function LoadingState({ view }: { view: BookingsView }) {
  return (
    <div className='space-y-4'>
      <div className='h-40 animate-pulse rounded-xl border bg-muted/40' aria-hidden />
      {view === 'grid' ? (
        <div className='grid gap-3 lg:grid-cols-2'>
          {[0, 1, 2, 3].map((index) => (
            <BookingCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <ul className='divide-y overflow-hidden rounded-xl border bg-card'>
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className='flex items-center gap-3 px-4 py-3'>
              <div className='h-9 w-20 animate-pulse rounded bg-muted' />
              <div className='flex-1 space-y-1.5'>
                <div className='h-3 w-32 animate-pulse rounded bg-muted' />
                <div className='h-3 w-52 animate-pulse rounded bg-muted' />
              </div>
            </li>
          ))}
        </ul>
      )}
      <span className='sr-only' role='status'>
        Memuat booking...
      </span>
    </div>
  )
}

function EmptyState({ scope }: { scope: Scope }) {
  return (
    <Card className='border-dashed shadow-none'>
      <CardContent className='flex flex-col items-center gap-3 py-14 text-center'>
        <div className='flex size-11 items-center justify-center rounded-full bg-muted'>
          <CalendarX2 className='size-5 text-muted-foreground' aria-hidden />
        </div>
        <div className='space-y-1'>
          <p className='text-sm font-medium'>
            {scope === 'active' ? 'Belum ada booking aktif' : 'Belum ada riwayat booking'}
          </p>
          <p className='text-sm text-muted-foreground'>
            {scope === 'active'
              ? 'Buat booking untuk mengunci slot jam bongkar muat.'
              : 'Booking yang sudah selesai akan muncul di sini.'}
          </p>
        </div>
        {scope === 'active' && (
          <Button asChild size='sm'>
            <Link to='/bookings/new'>
              <Plus /> Buat booking pertama
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
