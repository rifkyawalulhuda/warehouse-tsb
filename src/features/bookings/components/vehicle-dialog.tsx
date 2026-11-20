import { useEffect, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { updateVehicleInfo } from '@/lib/api/endpoints'
import type { Booking } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useT, type MessageKey, type Vars } from '@/lib/i18n'

type Translate = (key: MessageKey, vars?: Vars) => string

const makeSchema = (t: Translate) =>
  z.object({
    licensePlate: z
      .string()
      .trim()
      .min(1, t('bookings.vehicle.plateRequired'))
      .max(16),
    driverName: z
      .string()
      .trim()
      .min(2, t('bookings.vehicle.driverRequired'))
      .max(120),
    driverPhone: z.string().trim().max(20).optional(),
  })

type FormValues = z.infer<ReturnType<typeof makeSchema>>

/**
 * Booking tidak boleh gate-in sebelum plat nomor dan nama supir terisi. Dialog
 * ini yang memindahkan status `BOOKED_INCOMPLETE` menjadi `BOOKED_READY`.
 */
export function VehicleDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const t = useT()
  const schema = useMemo(() => makeSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      licensePlate: booking.licensePlate ?? '',
      driverName: booking.driverName ?? '',
      driverPhone: booking.driverPhone ?? '',
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      licensePlate: booking.licensePlate ?? '',
      driverName: booking.driverName ?? '',
      driverPhone: booking.driverPhone ?? '',
    })
  }, [open, booking, form])

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      updateVehicleInfo(booking.id, {
        licensePlate: values.licensePlate.toUpperCase(),
        driverName: values.driverName,
        driverPhone: values.driverPhone || undefined,
      }),
    onSuccess: () => {
      toast.success(t('bookings.vehicle.saved'))
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bookings.vehicle.title')}</DialogTitle>
          <DialogDescription>
            {t('bookings.vehicle.dialogDesc', { code: booking.bookingCode })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => save.mutate(values))}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='licensePlate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('bookings.vehicle.plate')}</FormLabel>
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
                  <FormLabel>{t('bookings.vehicle.driver')}</FormLabel>
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
                  <FormLabel>{t('bookings.create.phoneOptional')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('bookings.create.phonePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('bookings.vehicle.phoneHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={save.isPending}
              >
                {t('bookings.vehicle.cancel')}
              </Button>
              <Button type='submit' disabled={save.isPending}>
                {save.isPending && <Loader2 className='animate-spin' />}
                {save.isPending
                  ? t('bookings.vehicle.saving')
                  : t('bookings.vehicle.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
