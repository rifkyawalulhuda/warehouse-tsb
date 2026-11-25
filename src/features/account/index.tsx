import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Settings2 } from 'lucide-react'
import { fetchAccount } from '@/lib/api/endpoints'
import { formatDate, roleLabels } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { EmailSection } from './email-section'
import { PasswordSection } from './password-section'
import { ProfileSection } from './profile-section'
import { SessionsSection } from './sessions-section'

/**
 * Pengaturan Akun.
 *
 * Satu halaman untuk semua peran. Yang berbeda antar peran hanya keterangan
 * identitas (peran, perusahaan) dan tautan ke Pengaturan Gudang yang muncul
 * untuk Admin — isinya sendiri sama, jadi tidak ada cabang tata letak yang
 * harus dijaga dua kali.
 */
export function AccountPage() {
  const t = useT()
  const account = useQuery({ queryKey: ['account'], queryFn: fetchAccount })

  return (
    <Main className='flex w-full flex-1 flex-col gap-6'>
      <PageHeader
        title={t('account.title')}
        description={t('account.description')}
      />

      {account.isPending && <LoadingBlock />}
      {account.isError && (
        <ErrorBlock error={account.error} onRetry={() => account.refetch()} />
      )}

      {account.data && (
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-5'>
          <section className='flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border bg-card px-5 py-4 shadow-xs sm:px-7'>
            <div className='min-w-0 space-y-0.5'>
              <p className='truncate font-semibold'>{account.data.name}</p>
              <p className='truncate font-mono text-xs text-muted-foreground'>
                {account.data.email}
              </p>
            </div>
            <div className='ms-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground'>
              <span className='flex items-center gap-2'>
                <span className='text-muted-foreground/80'>
                  {t('account.role')}
                </span>
                <Badge variant='secondary'>{roleLabels[account.data.role]}</Badge>
              </span>
              {account.data.customerName && (
                <span className='flex items-center gap-2'>
                  <span className='text-muted-foreground/80'>
                    {t('account.company')}
                  </span>
                  <span className='font-medium text-foreground'>
                    {account.data.customerName}
                  </span>
                </span>
              )}
              <span className='flex items-center gap-2'>
                <span className='text-muted-foreground/80'>
                  {t('account.memberSince')}
                </span>
                <span className='font-medium text-foreground'>
                  {formatDate(account.data.createdAt)}
                </span>
              </span>
            </div>
          </section>

          <ProfileSection profile={account.data} />
          <EmailSection profile={account.data} />
          <PasswordSection />
          <SessionsSection profile={account.data} />

          <section className='rounded-xl border bg-muted/30 px-5 py-4 text-sm sm:px-7'>
            <p className='font-medium'>{t('account.help.title')}</p>
            <p className='mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground'>
              {t('account.help.body')}
            </p>
            {account.data.role === 'ADMIN' && (
              <Link
                to='/settings'
                className='mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline'
              >
                <Settings2 className='size-3.5' aria-hidden />
                {t('account.help.warehouseSettings')}
              </Link>
            )}
          </section>
        </div>
      )}
    </Main>
  )
}