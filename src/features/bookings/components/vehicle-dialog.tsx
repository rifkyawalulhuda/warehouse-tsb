import { useEffect } from 'react'
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

const schema = z.object({
  licensePlate: z.string().trim().min(1, 'Plat nomor wajib diisi').max(16),
  driverName: z.string().trim().min(2, 'Nama supir wajib diisi').max(120),
  driverPhone: z.string().trim().max(20).optional(),
})

type FormValues = z.infer<typeof schema>

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
      toast.success('Data kendaraan tersimpan')
      void queryClient.invalidateQueries({ queryKey: ['bookings'] })
      onOpenChange(false)
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lengkapi data kendaraan</DialogTitle>
          <DialogDescription>
            Booking {booking.bookingCode} belum bisa gate-in sebelum plat nomor dan nama
            supir diisi.
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
                  <FormLabel>Plat nomor</FormLabel>
                  <FormControl>
                    <Input placeholder='B 1234 XYZ' className='uppercase' {...field} />
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
                  <FormLabel>Nama supir</FormLabel>
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
                  <FormDescription>Dipakai untuk mengirim tautan tiket.</FormDescription>
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
                Batal
              </Button>
              <Button type='submit' disabled={save.isPending}>
                {save.isPending && <Loader2 className='animate-spin' />}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
