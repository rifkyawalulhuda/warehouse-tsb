import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { fetchSettings, saveSettings } from '@/lib/api/endpoints'
import type { Settings } from '@/lib/api/types'
import { labelToMinute } from '@/lib/format'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AppearancePicker } from './appearance-picker'

type FormState = {
  warehouseName: string
  open: string
  close: string
  slotUnitMinutes: string
  gracePeriodMinutes: string
  earlyArrivalLimitMinutes: string
  bookingWindowDays: string
}

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  if (settings.isPending) return <LoadingBlock label='Memuat pengaturan...' />
  if (settings.isError)
    return <ErrorBlock error={settings.error} onRetry={() => void settings.refetch()} />

  // `key` membuat form diinisialisasi ulang setiap data server berubah (mis.
  // setelah simpan), tanpa perlu menyinkronkan state lewat effect.
  return (
    <SettingsForm key={settings.dataUpdatedAt} settings={settings.data} />
  )
}

function SettingsForm({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(() => ({
    warehouseName: settings.warehouseName,
    open: settings.operatingStartLabel,
    close: settings.operatingEndLabel,
    slotUnitMinutes: String(settings.slotUnitMinutes),
    gracePeriodMinutes: String(settings.gracePeriodMinutes),
    earlyArrivalLimitMinutes: String(settings.earlyArrivalLimitMinutes),
    bookingWindowDays: String(settings.bookingWindowDays),
  }))

  const save = useMutation({
    mutationFn: (payload: FormState) =>
      saveSettings({
        warehouseName: payload.warehouseName.trim(),
        operatingStartMinute: labelToMinute(payload.open),
        operatingEndMinute: labelToMinute(payload.close),
        slotUnitMinutes: Number(payload.slotUnitMinutes),
        gracePeriodMinutes: Number(payload.gracePeriodMinutes),
        earlyArrivalLimitMinutes: Number(payload.earlyArrivalLimitMinutes),
        bookingWindowDays: Number(payload.bookingWindowDays),
      }),
    onSuccess: () => {
      toast.success('Pengaturan disimpan')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const windowMinutes =
    labelToMinute(form.close) - labelToMinute(form.open)
  const blocks = Math.floor(windowMinutes / Number(form.slotUnitMinutes || 30))

  return (
    <Main className='mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6'>
      <PageHeader
        title='Pengaturan'
        description='Jam operasional, masa tenggang, dan batas kedatangan awal.'
        actions={
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className='animate-spin' /> : <Save />}
            Simpan
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Tampilan</CardTitle>
          <CardDescription>
            Pilih tema terang atau gelap. Berlaku di peramban ini saja, bukan di akun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppearancePicker />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Identitas gudang</CardTitle>
          <CardDescription>Nama ini muncul di tiket supir.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='max-w-sm space-y-1'>
            <Label htmlFor='warehouse-name'>Nama gudang</Label>
            <Input
              id='warehouse-name'
              value={form.warehouseName}
              onChange={(event) =>
                setForm({ ...form, warehouseName: event.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Jam operasional</CardTitle>
          <CardDescription>
            {blocks > 0
              ? `${blocks} blok ${form.slotUnitMinutes} menit per hari.`
              : 'Rentang jam harus kelipatan satuan blok.'}
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-3'>
          <div className='space-y-1'>
            <Label htmlFor='open'>Jam buka</Label>
            <Input
              id='open'
              type='time'
              value={form.open}
              onChange={(event) => setForm({ ...form, open: event.target.value })}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='close'>Jam tutup</Label>
            <Input
              id='close'
              type='time'
              value={form.close}
              onChange={(event) => setForm({ ...form, close: event.target.value })}
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='unit'>Satuan blok (menit)</Label>
            <Input
              id='unit'
              type='number'
              min={15}
              max={120}
              step={15}
              value={form.slotUnitMinutes}
              onChange={(event) =>
                setForm({ ...form, slotUnitMinutes: event.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Aturan kedatangan</CardTitle>
          <CardDescription>
            Masa tenggang menentukan kapan truk dianggap terlambat. Batas kedatangan
            awal mencegah truk menumpuk sebelum jamnya.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1'>
            <Label htmlFor='grace'>Masa tenggang (menit)</Label>
            <Input
              id='grace'
              type='number'
              min={0}
              max={240}
              value={form.gracePeriodMinutes}
              onChange={(event) =>
                setForm({ ...form, gracePeriodMinutes: event.target.value })
              }
            />
            <p className='text-xs text-muted-foreground'>
              Truk yang datang dalam {form.gracePeriodMinutes} menit setelah jadwal
              masih dihitung tepat waktu.
            </p>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='early'>Batas datang awal (menit)</Label>
            <Input
              id='early'
              type='number'
              min={0}
              max={480}
              value={form.earlyArrivalLimitMinutes}
              onChange={(event) =>
                setForm({ ...form, earlyArrivalLimitMinutes: event.target.value })
              }
            />
            <p className='text-xs text-muted-foreground'>
              Gate-in ditolak bila lebih awal dari {form.earlyArrivalLimitMinutes}{' '}
              menit sebelum jadwal.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Jendela pemesanan</CardTitle>
          <CardDescription>
            Seberapa jauh ke depan customer boleh memesan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='max-w-xs space-y-1'>
            <Label htmlFor='window'>Hari ke depan</Label>
            <Input
              id='window'
              type='number'
              min={1}
              max={90}
              value={form.bookingWindowDays}
              onChange={(event) =>
                setForm({ ...form, bookingWindowDays: event.target.value })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <p className='text-xs text-muted-foreground'>
        Kapasitas kuota per slot tidak diatur di sini — nilainya mengikuti jumlah dock
        aktif di Master Data.
      </p>
    </Main>
  )
}
