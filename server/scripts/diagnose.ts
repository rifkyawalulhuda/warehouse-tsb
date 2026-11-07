import { prisma } from '../src/lib/prisma'

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ booking_date: Date; last_number: number }>
  >`SELECT booking_date, last_number FROM booking_day_sequences ORDER BY booking_date`
  console.log('sequences:', rows)

  const bookings = await prisma.booking.findMany({
    select: { bookingCode: true, bookingDate: true, qrToken: true },
    orderBy: { bookingDate: 'desc' },
    take: 20,
  })
  console.log('bookings:')
  for (const b of bookings) {
    console.log(` ${b.bookingCode} ${b.bookingDate.toISOString().slice(0, 10)} ${b.qrToken}`)
  }

  const dupCodes = await prisma.$queryRaw<
    Array<{ booking_code: string; n: bigint }>
  >`SELECT booking_code, COUNT(*) AS n FROM bookings GROUP BY booking_code HAVING COUNT(*) > 1`
  console.log('dup codes:', dupCodes)

  const slots = await prisma.$queryRaw<
    Array<{ slot_date: Date; activity: string; slot_start_minute: number; capacity: number; used: number }>
  >`SELECT slot_date, activity, slot_start_minute, capacity, used FROM slot_allocations
    WHERE slot_date >= CURRENT_DATE ORDER BY slot_date, activity, slot_start_minute LIMIT 20`
  console.log('slots:')
  for (const s of slots) {
    console.log(` ${s.slot_date.toISOString().slice(0, 10)} ${s.activity} ${s.slot_start_minute} cap=${s.capacity} used=${s.used}`)
  }
}

main().finally(() => prisma.$disconnect())
