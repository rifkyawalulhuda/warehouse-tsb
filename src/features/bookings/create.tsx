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
import { useT, useLocale, type MessageKey, type Vars } from '@/lib/i18n'
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
import { slotLimitLabel } from './booking-view'

type Translate = (key: MessageKey, vars?: Vars) => string

const makeFormSchema = (t: Translate, requireProcessType: boolean) =>
  z.object({
    bookingDate: z.string().min(1, t('bookings.create.dateRequired')),
    activityType: z.enum(['LOADING', 'UNLOADING']),
    truckTypeId: z.string().min(1, t('bookings.create.truckTypeRequired')),
    // Wajib hanya bila Master Data berisi jenis proses aktif. Kalau gudang
    // belum mengisi satu pun, kolom ini tidak ditampilkan dan tidak boleh
    // memblokir booking — server memakai aturan yang sama.
    processTypeId: requireProcessType
      ? z.string().min(1, t('bookings.create.processTypeRequired'))
      : z.string(),
    startMinute: z.string().min(1, t('bookings.create.arrivalRequired')),
    referenceDocNo: z
      .string()
      .trim()
      .min(2, t('bookings.create.docNoRequired'))
      .max(80),
    licensePlate: z.string().trim().max(16).optional(),
    driverName: z.string().trim().max(120).optional(),
    driverPhone: z.string().trim().max(20).optional(),
  })

type FormValues = z.infer<ReturnType<typeof makeFormSchema>>

export function CreateBooking() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const company = useCustomerName()
  const t = useT()

  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  const processTypes = settings.data?.processTypes ?? []
  const requireProcessType = processTypes.length > 0

  const schema = useMemo(
    () => makeFormSchema(t, requireProcessType),
    [t, requireProcessType]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      bookingDate: todayISO(),
      activityType: 'UNLOADING',
      truckTypeId: '',
      processTypeId: '',
      startMinute: '',
      referenceDocNo: '',
      licensePlate: '',
      driverName: '',
      driverPhone: '',
    },
  })

  const values = form.watch()
  const maxDate = addDaysISO(todayISO(), settings.data?.bookingWindowDays ?? 7)

  // Jenis proses MENAMBAH durasi truk, jadi ketersediaan tanpa `processTypeId`
  // dihitung untuk truk yang lebih pendek. Menampilkan jam itu membuat customer
  // memilih slot yang ternyata tidak muat lalu ditolak saat menyimpan, karena
  // itu daftar jam baru diambil setelah jenis proses dipilih.
  const needsProcessType = requireProcessType && !values.processTypeId

  const availability = useQuery({
    queryKey: [
      'availability',
      values.bookingDate,
      values.activityType,
      values.truckTypeId,
      values.processTypeId,
    ],
    queryFn: () =>
      fetchAvailability({
        date: values.bookingDate,
        activity: values.activityType,
        truckTypeId: Number(values.truckTypeId),
        processTypeId: values.processTypeId
          ? Number(values.processTypeId)
          : undefined,
      }),
    enabled:
      Boolean(values.bookingDate && values.truckTypeId) && !needsProcessType,
  })

  const truckTypes = settings.data?.truckTypes ?? []
  const selectedTruck = truckTypes.find(
    (t) => String(t.id) === values.truckTypeId
  )

  const selectedProcess = processTypes.find(
    (p) => String(p.id) === values.processTypeId
  )
  // Durasi total = jenis truk + jenis proses. Angka yang benar-benar dikunci
  // dihitung server dan dikirim lewat `availability.blocksRequired`.
  const totalMinutes = selectedTruck
    ? selectedTruck.durationMinutes + (selectedProcess?.durationMinutes ?? 0)
    : undefined

  const submit = useMutation({
    mutationFn: (payload: FormValues) =>
      createBooking({
        bookingDate: payload.bookingDate,
        activityType: payload.activityType as ActivityType,
        truckTypeId: Number(payload.truckTypeId),
        processTypeId: payload.processTypeId
          ? Number(payload.processTypeId)
          : undefined,
        startMinute: Number(payload.startMinute),
        referenceDocNo: payload.referenceDocNo,
        licensePlate: payload.licensePlate || undefined,
        driverName: payload.driverName || undefined,
        driverPhone: payload.driverPhone || undefined,
      }),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(
        t('bookings.create.successBody', { code: booking.bookingCode })
      )
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

  if (settings.isPending)
    return <LoadingBlock label={t('bookings.create.loadSettings')} />
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
        title={t('bookings.create.title')}
        description={t('bookings.create.subtitle')}
        actions={
          <Button
            variant='outline'
            size='sm'
            onClick={() => void navigate({ to: '/bookings' })}
          >
            <ArrowLeft />
            {t('bookings.create.back')}
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
                <CardTitle className='text-base'>
                  {t('bookings.create.stepActivity')}
                </CardTitle>
                <CardDescription>
                  {t('bookings.create.stepActivityDesc', {
                    minutes: settings.data?.slotUnitMinutes ?? 30,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='activityType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('bookings.activity')}</FormLabel>
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
                      <FormLabel>{t('bookings.create.truckType')}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('bookings.create.truckType')}
                            />
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

                {requireProcessType && (
                  <FormField
                    control={form.control}
                    name='processTypeId'
                    render={({ field }) => (
                      <FormItem className='sm:col-span-2'>
                        <FormLabel>
                          {t('bookings.create.processType')}
                        </FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Durasi total berubah, jadi slot yang muat pun
                            // berubah — pilihan jam lama bisa jadi tidak sah.
                            form.setValue('startMinute', '')
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t(
                                  'bookings.create.processTypePlaceholder'
                                )}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {processTypes.map((process) => (
                              <SelectItem
                                key={process.id}
                                value={String(process.id)}
                              >
                                {process.name} ·{' '}
                                {durationLabel(process.durationMinutes)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('bookings.create.processTypeHint')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  {t('bookings.create.stepDate')}
                </CardTitle>
                <CardDescription>
                  {t('bookings.create.windowHint', {
                    days: settings.data.bookingWindowDays,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name='bookingDate'
                  render={({ field }) => (
                    <FormItem className='max-w-xs'>
                      <FormLabel>{t('bookings.create.date')}</FormLabel>
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
                <CardTitle className='text-base'>
                  {t('bookings.create.stepTime')}
                </CardTitle>
                <CardDescription>
                  {!values.truckTypeId
                    ? t('bookings.create.truckTypeFirst')
                    : needsProcessType
                      ? t('bookings.create.processTypeFirst')
                      : t('bookings.create.slotsAvailable', {
                          count: availableCount,
                        })}
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
                            {t('bookings.create.awaitTruckType')}
                          </p>
                        ) : needsProcessType ? (
                          <p className='py-6 text-center text-sm text-muted-foreground'>
                            {t('bookings.create.awaitProcessType')}
                          </p>
                        ) : availability.isPending ? (
                          <LoadingBlock label={t('bookings.create.checking')} />
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
                  {t('bookings.create.stepDocs')}
                </CardTitle>
                <CardDescription>
                  {t('bookings.create.stepDocsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='referenceDocNo'
                  render={({ field }) => (
                    <FormItem className='sm:col-span-2'>
                      <FormLabel>{t('bookings.create.docNoLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('bookings.create.docNoPlaceholder')}
                          {...field}
                        />
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
                      <FormLabel>
                        {t('bookings.create.plateOptional')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('bookings.create.platePlaceholder')}
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
                      <FormLabel>
                        {t('bookings.create.driverOptional')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('bookings.create.driverPlaceholder')}
                          {...field}
                        />
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
                      <FormLabel>
                        {t('bookings.create.phoneOptional')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('bookings.create.phonePlaceholder')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('bookings.create.phoneHint')}
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
                <CardTitle className='text-base'>
                  {t('bookings.create.summary')}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-3 text-sm'>
                <SummaryRow
                  label={t('bookings.activity')}
                  value={activityLabels[values.activityType]}
                />
                <SummaryRow
                  label={t('bookings.create.truckType')}
                  value={selectedTruck?.truckName ?? '-'}
                />
                {requireProcessType && (
                  <SummaryRow
                    label={t('bookings.create.processType')}
                    value={selectedProcess?.name ?? '-'}
                  />
                )}
                <SummaryRow
                  label={t('bookings.duration')}
                  value={totalMinutes ? durationLabel(totalMinutes) : '-'}
                />
                <Separator />
                <SummaryRow
                  label={t('bookings.create.date')}
                  value={
                    values.bookingDate ? formatDate(values.bookingDate) : '-'
                  }
                />
                <SummaryRow
                  label={t('bookings.time')}
                  value={
                    values.startMinute
                      ? minuteToLabel(Number(values.startMinute))
                      : '-'
                  }
                />
                <SummaryRow
                  label={t('bookings.create.docNo')}
                  value={values.referenceDocNo || '-'}
                />
                {selectedTruck && values.startMinute && (
                  <div className='rounded-md bg-muted p-3 text-xs text-muted-foreground'>
                    {t('bookings.create.slotsUsed', {
                      // Angka server, karena penjumlahan truk + proses bisa
                      // melewati batas blok (2 → 3).
                      count:
                        availability.data?.blocksRequired ??
                        selectedTruck.blocksRequired,
                      // Panjang blok bisa diubah Admin (15–120 menit); angka 30
                      // yang ditulis di kamus akan berbohong setelah diubah.
                      minutes: settings.data?.slotUnitMinutes ?? 30,
                    })}
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
                  {t('bookings.create.confirm')}
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
  const t = useT()
  const locale = useLocale()

  if (slots.length === 0) {
    return (
      <p className='py-6 text-center text-sm text-muted-foreground'>
        {t('bookings.create.noSlots')}
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
                {slotLimitLabel(slot.limit, locale)}
              </span>
            ) : (
              <Badge variant='outline' className='mt-1 text-xs'>
                {t('bookings.create.slotsRemaining', {
                  count: slot.remaining,
                })}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
