import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCustomerName } from '@/stores/auth-store'
import { apiErrorMessage } from '@/lib/api/client'
import {
  createBooking,
  fetchAvailability,
  fetchSettings,
} from '@/lib/api/endpoints'
import type { ActivityType, AvailabilitySlot } from '@/lib/api/types'
import {
  activityLabels,
  addDaysISO,
  durationLabel,
  formatDate,
  minuteToLabel,
  todayISO,
} from '@/lib/format'
import { cn } from '@/lib/utils'
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from '@/components/date-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'

const formSchema = z.object({
  bookingDate: z.string().min(1, 'Pilih tanggal'),
  activityType: z.enum(['LOADING', 'UNLOADING']),
  truckTypeId: z.string().min(1, 'Pilih jenis truk'),
  startMinute: z.string().min(1, 'Pilih jam kedatangan'),
  referenceDocNo: z.string().trim().min(2, 'Nomor dokumen wajib diisi').max(80),
  licensePlate: z.string().trim().max(16).optional(),
  driverName: z.string().trim().max(120).optional(),
  driverPhone: z.string().trim().max(20).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function CreateBooking() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCustomerName()

  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bookingDate: todayISO(),
      activityType: 'UNLOADING',
      truckTypeId: '',
      startMinute: '',
      referenceDocNo: '',
      licensePlate: '',
      driverName: '',
      driverPhone: '',
    },
  })

  const values = form.watch()
  const maxDate = addDaysISO(todayISO(), settings.data?.bookingWindowDays ?? 7)

  const availability = useQuery({
    queryKey: [
      'availability',
      values.bookingDate,
      values.activityType,
      values.truckTypeId,
    ],
    queryFn: () =>
      fetchAvailability({
        date: values.bookingDate,
        activity: values.activityType,
        truckTypeId: Number(values.truckTypeId),
      }),
    enabled: Boolean(values.bookingDate && values.truckTypeId),
  })

  const truckTypes = settings.data?.truckTypes ?? []
  const selectedTruck = truckTypes.find(
    (t) => String(t.id) === values.truckTypeId
  )

  const submit = useMutation({
    mutationFn: (payload: FormValues) =>
      createBooking({
        bookingDate: payload.bookingDate,
        activityType: payload.activityType as ActivityType,
        truckTypeId: Number(payload.truckTypeId),
        startMinute: Number(payload.startMinute),
        referenceDocNo: payload.referenceDocNo,
        licensePlate: payload.licensePlate || undefined,
        driverName: payload.driverName || undefined,
        driverPhone: payload.driverPhone || undefined,
      }),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(`Booking ${booking.bookingCode} berhasil dibuat`)
      void navigate({ to: '/bookings' })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  const availableCount = useMemo(
    () =>
      availability.data?.slots.filter((s) => s.status === 'AVAILABLE').length ??
      0,
    [availability.data]
  )

  if (settings.isPending) return <LoadingBlock label='Memuat pengaturan...' />
  if (settings.isError)
    return (
      <ErrorBlock
        error={settings.error}
        onRetry={() => void settings.refetch()}
      />
    )

  return (
    <Main className='flex flex-1 flex-col gap-6'>
      <PageHeader
        eyebrow={company ?? undefined}
        title='Buat Booking'
        description='Pilih jadwal kedatangan truk Anda. Slot yang penuh otomatis tidak bisa dipilih.'
        actions={
          <Button
            variant='outline'
            size='sm'
            onClick={() => void navigate({ to: '/bookings' })}
          >
            <ArrowLeft />
            Kembali
          </Button>
        }
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((payload) => submit.mutate(payload))}
          className='grid gap-6 lg:grid-cols-[1fr_320px]'
        >
          <div className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>1. Aktivitas & truk</CardTitle>
                <CardDescription>
                  Durasi tiap jenis truk menentukan berapa slot 30 menit yang
                  dipakai.
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='activityType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aktivitas</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(['UNLOADING', 'LOADING'] as ActivityType[]).map(
                            (activity) => (
                              <SelectItem key={activity} value={activity}>
                                {activityLabels[activity]}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='truckTypeId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis truk</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Pilih jenis truk' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {truckTypes.map((truck) => (
                            <SelectItem key={truck.id} value={String(truck.id)}>
                              {truck.truckName} ·{' '}
                              {durationLabel(truck.durationMinutes)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  2. Tanggal kedatangan
                </CardTitle>
                <CardDescription>
                  Pemesanan dibuka sampai {settings.data.bookingWindowDays} hari
                  ke depan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name='bookingDate'
                  render={({ field }) => (
                    <FormItem className='max-w-xs'>
                      <FormLabel>Tanggal</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          min={todayISO()}
                          max={maxDate}
                          onBlur={field.onBlur}
                          className='w-full'
                          onChange={(value) => {
                            field.onChange(value)
                            form.setValue('startMinute', '')
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>3. Jam kedatangan</CardTitle>
                <CardDescription>
                  {values.truckTypeId
                    ? `${availableCount} slot tersedia untuk tanggal ini.`
                    : 'Pilih jenis truk dulu untuk melihat ketersediaan.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name='startMinute'
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        {!values.truckTypeId ? (
                          <p className='py-6 text-center text-sm text-muted-foreground'>
                            Menunggu pilihan jenis truk.
                          </p>
                        ) : availability.isPending ? (
                          <LoadingBlock label='Memeriksa ketersediaan...' />
                        ) : availability.isError ? (
                          <ErrorBlock
                            error={availability.error}
                            onRetry={() => void availability.refetch()}
                          />
                        ) : (
                          <SlotGrid
                            slots={availability.data?.slots ?? []}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  4. Dokumen & kendaraan
                </CardTitle>
                <CardDescription>
                  Plat nomor dan nama supir boleh menyusul, tetapi truk tidak
                  bisa gate-in sebelum lengkap.
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='referenceDocNo'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>Nomor dokumen (DO / Invoice)</FormLabel>
                      <FormControl>
                        <Input placeholder='DO-2026-00123' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='licensePlate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plat nomor (opsional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='B 1234 XYZ'
                          className='uppercase'
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='driverName'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama supir (opsional)</FormLabel>
                      <FormControl>
                        <Input placeholder='Nama supir' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='driverPhone'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor HP supir (opsional)</FormLabel>
                      <FormControl>
                        <Input placeholder='0812xxxxxxx' {...field} />
                      </FormControl>
                      <FormDescription>
                        Untuk kirim link tiket via WhatsApp.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className='lg:sticky lg:top-6 lg:self-start'>
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>Ringkasan</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                <SummaryRow
                  label='Aktivitas'
                  value={activityLabels[values.activityType]}
                />
                <SummaryRow
                  label='Jenis truk'
                  value={selectedTruck?.truckName ?? '-'}
                />
                <SummaryRow
                  label='Durasi'
                  value={
                    selectedTruck
                      ? durationLabel(selectedTruck.durationMinutes)
                      : '-'
                  }
                />
                <Separator />
                <SummaryRow
                  label='Tanggal'
                  value={
                    values.bookingDate ? formatDate(values.bookingDate) : '-'
                  }
                />
                <SummaryRow
                  label='Jam'
                  value={
                    values.startMinute
                      ? minuteToLabel(Number(values.startMinute))
                      : '-'
                  }
                />
                <SummaryRow
                  label='Dokumen'
                  value={values.referenceDocNo || '-'}
                />
                {selectedTruck && values.startMinute && (
                  <div className='rounded-md bg-muted p-3 text-xs text-muted-foreground'>
                    Truk memakai {selectedTruck.blocksRequired} slot × 30 menit.
                  </div>
                )}

                {submit.isError && (
                  <div className='flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive'>
                    <AlertTriangle className='size-4 shrink-0' />
                    {apiErrorMessage(submit.error)}
                  </div>
                )}

                <Button
                  type='submit'
                  className='w-full'
                  disabled={submit.isPending}
                >
                  {submit.isPending ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Check />
                  )}
                  Konfirmasi booking
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </Main>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-3'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-end font-medium'>{value}</span>
    </div>
  )
}

function SlotGrid({
  slots,
  value,
  onChange,
}: {
  slots: AvailabilitySlot[]
  value: string
  onChange: (value: string) => void
}) {
  if (slots.length === 0) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        Tidak ada slot pada tanggal ini.
      </p>
    )
  }

  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4'>
      {slots.map((slot) => {
        const selected = value === String(slot.startMinute)
        const full = slot.status === 'FULL'
        return (
          <button
            key={slot.startMinute}
            type='button'
            disabled={full}
            onClick={() => onChange(String(slot.startMinute))}
            className={cn(
              'rounded-lg border p-3 text-start transition-colors',
              full
                ? 'cursor-not-allowed border-dashed opacity-50'
                : 'hover:border-primary hover:bg-accent',
              selected && 'border-primary bg-primary/5 ring-1 ring-primary'
            )}
          >
            <span className='block text-sm font-semibold'>
              {slot.startLabel}–{slot.endLabel}
            </span>
            {full ? (
              <span className='mt-1 block text-xs text-muted-foreground'>
                {slot.limitReason ?? 'Penuh'}
              </span>
            ) : (
              <Badge variant='outline' className='mt-1 text-xs'>
                {slot.remaining} slot tersisa
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
