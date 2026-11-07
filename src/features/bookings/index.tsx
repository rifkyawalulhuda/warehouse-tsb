import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { fetchMyBookings } from '@/lib/api/endpoints'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookingCard } from './components/booking-card'

export function MyBookings() {
  const [scope, setScope] = useState<'active' | 'past'>('active')
  useRealtimeSync()

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['bookings', 'my', scope],
    queryFn: () => fetchMyBookings(scope),
  })

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Jadwal Saya'
        description='Semua booking truk yang Anda buat.'
        actions={
          <Button asChild>
            <Link to='/bookings/new'>
              <Plus /> Booking Baru
            </Link>
          </Button>
        }
      />

      <Tabs value={scope} onValueChange={(value) => setScope(value as 'active' | 'past')}>
        <TabsList>
          <TabsTrigger value='active'>Aktif</TabsTrigger>
          <TabsTrigger value='past'>Riwayat</TabsTrigger>
        </TabsList>
      </Tabs>

      {isPending ? (
        <LoadingBlock label='Memuat booking...' />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => void refetch()} />
      ) : data.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
            <p className='text-sm text-muted-foreground'>
              {scope === 'active'
                ? 'Belum ada booking aktif. Buat booking untuk mengunci slot.'
                : 'Belum ada riwayat booking.'}
            </p>
            {scope === 'active' && (
              <Button asChild size='sm'>
                <Link to='/bookings/new'>Buat booking pertama</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 xl:grid-cols-2'>
          {data.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </Main>
  )
}
