import { cn } from '@/lib/utils'
import { useSetPageTitle } from '@/context/page-title-provider'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  // Judul ini juga yang tampil di bilah atas mobile, jadi hanya ada satu
  // sumber judul — tidak ada daftar kedua yang bisa melenceng.
  useSetPageTitle(title)

  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className='space-y-1'>
        {/*
          Di layar sempit judulnya sudah tampil di bilah atas. Disembunyikan
          secara visual, bukan dilepas dari dokumen, supaya struktur heading
          halaman tetap utuh untuk pembaca layar.
        */}
        <h1 className='text-2xl font-semibold tracking-tight max-md:sr-only'>{title}</h1>
        {description && <p className='text-sm text-muted-foreground'>{description}</p>}
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
    </div>
  )
}
