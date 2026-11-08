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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  approvalMode: 'AUTO' | 'MANUAL'
  approvalLeadMinutes: string
  approvalMinDecisionMinutes: string
  approvalUrgentBufferMinutes: string
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
    approvalMode: settings.approvalMode,
    approvalLeadMinutes: String(settings.approvalLeadMinutes),
    approvalMinDecisionMinutes: String(settings.approvalMinDecisionMinutes),
    approvalUrgentBufferMinutes: String(settings.approvalUrgentBufferMinutes),
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
        approvalMode: payload.approvalMode,
        approvalLeadMinutes: Number(payload.approvalLeadMinutes),
        approvalMinDecisionMinutes: Number(payload.approvalMinDecisionMinutes),
        approvalUrgentBufferMinutes: Number(payload.approvalUrgentBufferMinutes),
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

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Kebijakan persetujuan booking</CardTitle>
          <CardDescription>
            Otomatis: setiap booking langsung sah. Manual: hanya customer yang ditandai
            "booking otomatis" di halaman Pengguna yang lolos; sisanya menunggu keputusan
            Admin.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='max-w-xs space-y-1'>
            <Label htmlFor='approval-mode'>Mode</Label>
            <Select
              value={form.approvalMode}
              onValueChange={(value) =>
                setForm({ ...form, approvalMode: value as 'AUTO' | 'MANUAL' })
              }
            >
              <SelectTrigger id='approval-mode'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='AUTO'>Otomatis (semua langsung disetujui)</SelectItem>
                <SelectItem value='MANUAL'>Manual (perlu persetujuan Admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-4 sm:grid-cols-3'>
            <div className='space-y-1'>
              <Label htmlFor='approval-lead'>Tenggat sebelum kedatangan (menit)</Label>
              <Input
                id='approval-lead'
                type='number'
                min={5}
                max={2880}
                value={form.approvalLeadMinutes}
                onChange={(event) =>
                  setForm({ ...form, approvalLeadMinutes: event.target.value })
                }
              />
              <p className='text-xs text-muted-foreground'>
                Keputusan harus selesai sekian menit sebelum jam kedatangan.
              </p>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='approval-min'>Jendela keputusan minimum (menit)</Label>
              <Input
                id='approval-min'
                type='number'
                min={5}
                max={1440}
                value={form.approvalMinDecisionMinutes}
                onChange={(event) =>
                  setForm({ ...form, approvalMinDecisionMinutes: event.target.value })
                }
              />
              <p className='text-xs text-muted-foreground'>
                Booking mendesak tetap punya sekian menit untuk diputuskan.
              </p>
            </div>
            <div className='space-y-1'>
              <Label htmlFor='approval-urgent'>Ambang label mendesak (menit)</Label>
              <Input
                id='approval-urgent'
                type='number'
                min={0}
                max={14400}
                value={form.approvalUrgentBufferMinutes}
                onChange={(event) =>
                  setForm({ ...form, approvalUrgentBufferMinutes: event.target.value })
                }
              />
              <p className='text-xs text-muted-foreground'>
                Hanya memengaruhi penanda di antrean, bukan keputusan.
              </p>
            </div>
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
