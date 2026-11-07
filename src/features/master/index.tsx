import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createTruckType,
  fetchDocks,
  fetchSettings,
  updateDock,
} from '@/lib/api/endpoints'
import type { Dock } from '@/lib/api/types'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { durationLabel } from '@/lib/format'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/**
 * Kapasitas kuota tidak diatur manual di sini. Kuota per slot adalah jumlah dock
 * aktif yang mengizinkan aktivitas tersebut, jadi mengubah daftar dock berarti
 * mengubah kapasitas — satu sumber kebenaran, tidak ada dua angka yang bisa
 * saling bertentangan.
 */
export function MasterData() {
  useRealtimeSync()
  const queryClient = useQueryClient()

  const docks = useQuery({ queryKey: ['master', 'docks'], queryFn: fetchDocks })
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  const toggleDock = useMutation({
    mutationFn: ({ dock, status }: { dock: Dock; status: Dock['currentStatus'] }) =>
      updateDock(dock.id, { currentStatus: status }),
    onSuccess: () => {
      toast.success('Status dock diperbarui')
      void queryClient.invalidateQueries({ queryKey: ['master'] })
      void queryClient.invalidateQueries({ queryKey: ['ops'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        title='Master Data'
        description='Dock menentukan kapasitas per slot. Jenis truk menentukan durasi blok.'
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Dock</CardTitle>
          <CardDescription>
            {docks.data
              ? `Kapasitas per slot: ${docks.data.capacities.LOADING} loading, ${docks.data.capacities.UNLOADING} unloading.`
              : 'Memuat kapasitas...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docks.isPending ? (
            <LoadingBlock label='Memuat dock...' />
          ) : docks.isError ? (
            <ErrorBlock error={docks.error} onRetry={() => void docks.refetch()} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Melayani</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docks.data.docks.map((dock) => (
                  <TableRow key={dock.id}>
                    <TableCell className='font-medium'>{dock.dockCode}</TableCell>
                    <TableCell className='text-sm'>
                      {dock.allowedActivity === 'BOTH'
                        ? 'Loading & Unloading'
                        : dock.allowedActivity === 'LOADING'
                          ? 'Loading'
                          : 'Unloading'}
                    </TableCell>
                    <TableCell>
                      {dock.currentStatus === 'OCCUPIED' ? (
                        <div className='flex items-center gap-2'>
                          <Badge
                            variant='outline'
                            className='border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300'
                          >
                            Terpakai
                          </Badge>
                          <span className='text-xs text-muted-foreground'>
                            dikunci booking aktif
                          </span>
                        </div>
                      ) : (
                        <Select
                          value={dock.currentStatus}
                          disabled={toggleDock.isPending}
                          onValueChange={(value) =>
                            toggleDock.mutate({
                              dock,
                              status: value as Dock['currentStatus'],
                            })
                          }
                        >
                          <SelectTrigger className='h-8 w-40'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='AVAILABLE'>Tersedia</SelectItem>
                            <SelectItem value='MAINTENANCE'>Perawatan</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TruckTypeSection truckTypes={settings.data?.truckTypes ?? []} />
    </Main>
  )
}

function TruckTypeSection({
  truckTypes,
}: {
  truckTypes: { id: number; truckName: string; durationMinutes: number; blocksRequired: number }[]
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')

  const create = useMutation({
    mutationFn: () => {
      const minutes = Number(duration)
      return createTruckType({
        truckName: name.trim(),
        durationMinutes: minutes,
        blocksRequired: Math.ceil(minutes / 30),
        isActive: true,
        sortOrder: 99,
      })
    },
    onSuccess: () => {
      toast.success('Jenis truk ditambahkan')
      setName('')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const blocks = Number(duration) > 0 ? Math.ceil(Number(duration) / 30) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Jenis truk</CardTitle>
        <CardDescription>
          Durasi menentukan berapa blok 30 menit yang dikunci oleh satu booking.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-end gap-2'>
          <Input
            placeholder='Nama jenis truk'
            value={name}
            onChange={(event) => setName(event.target.value)}
            className='max-w-xs'
          />
          <Input
            type='number'
            min={30}
            step={30}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className='w-32'
          />
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || name.trim().length < 2}
          >
            {create.isPending ? <Loader2 className='animate-spin' /> : <Plus />}
            Tambah
          </Button>
        </div>

        <p className='text-xs text-muted-foreground'>
          {blocks > 0
            ? `Durasi ${durationLabel(Number(duration))} = ${blocks} blok 30 menit.`
            : 'Isi durasi dalam menit.'}
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jenis</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Blok</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {truckTypes.map((type) => (
              <TableRow key={type.id}>
                <TableCell className='font-medium'>{type.truckName}</TableCell>
                <TableCell className='text-sm'>
                  {durationLabel(type.durationMinutes)}
                </TableCell>
                <TableCell className='text-sm tabular-nums'>
                  {type.blocksRequired}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
