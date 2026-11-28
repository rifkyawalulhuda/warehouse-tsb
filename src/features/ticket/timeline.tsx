import { Check } from 'lucide-react'
import { formatTime } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Satu tahap pada linimasa: label yang sudah diterjemahkan + waktu ISO. */
export type TimelineStep = { label: string; at: string | null }

/**
 * Linimasa horizontal empat tahap truk (gate-in → mulai → selesai → gate-out).
 *
 * Bentuknya sengaja satu baris, bukan daftar vertikal: keempat tahap selalu
 * berurutan dan selalu empat, jadi menumpuknya ke bawah hanya memakan ruang
 * tanpa menambah informasi. Garis penghubung diwarnai per setengah, sehingga
 * kemajuan terbaca dari kiri ke kanan seperti progres.
 *
 * Status tidak boleh dibedakan lewat warna saja (buta warna, cetak hitam
 * putih), jadi ketiga keadaan punya bentuk sendiri: selesai = titik penuh
 * bercentang, sedang berjalan = titik penuh bercincin, belum = cincin kosong.
 * Tiap tahap juga membawa teks tersembunyi "selesai / sedang berjalan / belum"
 * untuk pembaca layar.
 */
export function TicketTimeline({ steps }: { steps: TimelineStep[] }) {
  const t = useT()
  const doneCount = steps.filter((step) => step.at).length
  // Tahap berjalan: yang pertama belum selesai, tetapi hanya kalau truk sudah
  // mulai. Sebelum gate-in semuanya masih "belum", bukan "sedang berjalan".
  const currentIndex = doneCount > 0 ? steps.findIndex((step) => !step.at) : -1

  return (
    <div className='space-y-4'>
      <div className='flex items-baseline justify-between gap-2'>
        <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
          {t('ticket.history')}
        </p>
        <p className='text-xs text-muted-foreground'>
          <span className='sr-only'>
            {t('ticket.stepsDone', { done: doneCount, total: steps.length })}
          </span>
          <span aria-hidden className='font-medium tabular-nums'>
            {doneCount}/{steps.length}
          </span>
        </p>
      </div>

      <ol
        className='grid'
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          const done = Boolean(step.at)
          const current = index === currentIndex
          const nextDone = Boolean(steps[index + 1]?.at)

          return (
            <li
              key={step.label}
              aria-current={current ? 'step' : undefined}
              className='relative flex flex-col items-center px-1 text-center'
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-2.5 left-0 h-0.5 w-1/2 rounded-full',
                    done ? 'bg-emerald-500' : 'bg-border'
                  )}
                />
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute top-2.5 right-0 h-0.5 w-1/2 rounded-full',
                    nextDone ? 'bg-emerald-500' : 'bg-border'
                  )}
                />
              )}

              <span
                aria-hidden
                className={cn(
                  'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 bg-card',
                  done && 'border-emerald-600 bg-emerald-600',
                  current && 'border-emerald-500 ring-4 ring-emerald-500/15'
                )}
              >
                {done ? (
                  <Check className='size-3 stroke-3 text-white' />
                ) : current ? (
                  <span className='size-1.5 rounded-full bg-emerald-500' />
                ) : null}
              </span>

              {/* Tinggi tetap: tahap yang belum lewat tetap memesan ruang yang
                  sama, jadi label keempat tahap duduk di garis yang rata. */}
              <span
                className={cn(
                  'mt-2 flex h-5 items-center text-sm leading-none tabular-nums',
                  done
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground/60'
                )}
              >
                {/* Em dash, bukan tanda hubung: `-` setinggi titik dan terbaca
                    seperti noda di antara titik-titik linimasa. */}
                {step.at ? formatTime(step.at) : '—'}
              </span>

              <span
                className={cn(
                  'mt-1 min-h-[2.2em] text-xs leading-tight text-balance',
                  current
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>

              <span className='sr-only'>
                {done
                  ? t('ticket.stepDone')
                  : current
                    ? t('ticket.stepCurrent')
                    : t('ticket.stepPending')}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
