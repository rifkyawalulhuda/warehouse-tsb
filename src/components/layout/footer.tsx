import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

type FooterProps = React.ComponentProps<'footer'>

export function Footer({ className, ...props }: FooterProps) {
  const t = useT()

  return (
    <footer
      className={cn(
        'text-muted-foreground mt-auto shrink-0 border-t px-4 py-4 text-center text-sm',
        className
      )}
      {...props}
    >
      <span>
        &copy; {new Date().getFullYear()} {t('footer.company')}
      </span>
      <span className='ms-2 text-muted-foreground/80'>
        &bull; {t('footer.location')}
      </span>
    </footer>
  )
}
