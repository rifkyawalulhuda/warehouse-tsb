type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='container grid h-svh max-w-none items-center justify-center'>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center gap-2'>
          <div className='flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
            <span className='text-lg font-bold'>T</span>
          </div>
          <div className='grid text-start leading-tight'>
            <h1 className='text-xl font-semibold'>Warehouse TSB</h1>
            <span className='text-xs text-muted-foreground'>
              Time Slot Booking
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
