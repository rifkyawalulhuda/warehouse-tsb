import { cn } from '@/lib/utils'

type FooterProps = React.ComponentProps<'footer'>

export function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      className={cn(
        'text-muted-foreground mt-auto shrink-0 border-t px-4 py-4 text-center text-sm',
        className
      )}
      {...props}
    >
      <span>
        &copy; {new Date().getFullYear()} TSB · Warehouse Time Slot Booking — PT
        Sankyu Indonesia
      </span>
      <span className='ms-2 text-muted-foreground/80'>
        &bull; Gudang Cikarang · Shift 1
      </span>
    </footer>
  )
}
