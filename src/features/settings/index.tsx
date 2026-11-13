import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Clock,
  LogIn,
  Palette,
  ShieldCheck,
  Truck,
  Type,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { BrandLogo } from '@/components/brand-logo'
import { DEFAULT_LOGIN_DESCRIPTION, tabTitle } from '@/lib/branding'
import { fetchSettings, saveSettings } from '@/lib/api/endpoints'
import type { Settings } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { ErrorBlock, LoadingBlock } from '@/components/query-state'
import { AppearancePicker } from './appearance-picker'
import {
  dirtySections,
  hoursNote,
  impactOf,
  isDirty,
  LOGIN_DESCRIPTION_MAX,
  restoreSection,
  sectionError,
  sectionPayload,
  toForm,
  type FormState,
  type SectionKey,
} from './form'
import { OperationsSummary, PolicyFlag } from './operations-summary'
import { FieldRow, NumberField, SectionPanel } from './section-panel'
import { LoginPanelFields } from './login-panel-fields'
import { LoginPreview } from './login-preview'
import { LogoField } from './logo-field'

type Tab = SectionKey | 'appearance'

const TABS: {
  key: Tab
  label: string
  icon: LucideIcon
  group: string
}[] = [
  {
    key: 'identity',
    label: 'Identitas gudang',
    icon: Warehouse,
    group: 'Gudang',
  },
  {
    key: 'brand',
    label: 'Identitas merek',
    icon: Type,
    group: 'Merek',
  },
  {
    key: 'login',
    label: 'Halaman masuk',
    icon: LogIn,
    group: 'Merek',
  },
  { key: 'hours', label: 'Jam operasional', icon: Clock, group: 'Operasional' },
  {
    key: 'arrival',
    label: 'Aturan kedatangan',
    icon: Truck,
    group: 'Operasional',
  },
  {
    key: 'window',
    label: 'Jendela pemesanan',
    icon: CalendarClock,
    group: 'Kebijakan',
  },
  {
    key: 'approval',
    label: 'Persetujuan booking',
    icon: ShieldCheck,
    group: 'Kebijakan',
  },
  { key: 'appearance', label: 'Tampilan', icon: Palette, group: 'Preferensi' },
]

/**
 * Input `type='time'` memakai ikon pemilih bawaan peramban yang gelap di tema
 * gelap — di atas kotak input gelap ikonnya nyaris tak terlihat. `invert`
 * membaliknya agar tetap terbaca, dan ukurannya dikecilkan supaya tidak
 * mendesak angka jamnya.
 */
const timeInputClass =
  'tabular-nums [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 dark:[&::-webkit-calendar-picker-indicator]:invert'

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  if (settings.isPending) return <LoadingBlock label='Memuat pengaturan...' />
  if (settings.isError)
    return (
      <ErrorBlock
        error={settings.error}
        onRetry={() => void settings.refetch()}
      />
    )

  // `key` menginisialisasi ulang form setiap data server berubah (mis. setelah
  // simpan), tanpa sinkronisasi state lewat effect.
  return <SettingsForm key={settings.dataUpdatedAt} settings={settings.data} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const queryClient = useQueryClient()
  // Salinan draf awal. `toForm` murah dan hanya bergantung pada `settings`,
  // yang nilainya tetap selama komponen ini hidup (parent memberi `key` baru
  // setiap data server berubah).
  const [saved] = useState<FormState>(() => toForm(settings))
  const [form, setForm] = useState<FormState>(saved)
  const [tab, setTab] = useState<Tab>('hours')

  const dirty = dirtySections(form, saved)
  const impact = impactOf(form)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = useMutation({
    mutationFn: (section: SectionKey) =>
      saveSettings(sectionPayload(section, form)),
    onSuccess: (_data, section) => {
      toast.success(MESSAGE_BY_SECTION[section])
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['availability'] })
      // Judul di sidebar, halaman masuk, dan tab peramban dibaca dari sini.
      void queryClient.invalidateQueries({ queryKey: ['branding'] })
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  })

  // Perubahan yang belum disimpan tidak boleh hilang tanpa peringatan saat tab
  // ditutup atau halaman dimuat ulang.
  useEffect(() => {
    if (dirty.length === 0) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty.length])

  const resetSection = (section: SectionKey) => {
    setForm((current) => restoreSection(current, saved, section))
  }

  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[1]

  return (
    <Main className='flex w-full flex-1 flex-col gap-6'>
      <PageHeader
        title='Pengaturan'
        description='Semua di sini langsung memengaruhi kuota slot dan kebijakan booking. Simpan per seksi agar perubahan kecil tidak menimpa yang lain.'
        actions={
          <span className='flex items-center gap-2 text-xs text-muted-foreground'>
            {dirty.length === 0 ? (
              <>
                <span
                  className='size-1.5 rounded-full bg-emerald-500'
                  aria-hidden
                />
                Semua tersimpan
              </>
            ) : (
              <>
                <span
                  className='size-1.5 rounded-full bg-amber-500'
                  aria-hidden
                />
                {dirty.length} seksi belum disimpan
              </>
            )}
          </span>
        }
      />

      <OperationsSummary
        impact={impact}
        saved={impactOf(saved)}
        dirtyCount={dirty.length}
      />

      <div className='grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-7'>
        <SectionNav
          active={tab}
          onSelect={setTab}
          dirty={dirty}
          manual={form.approvalMode === 'MANUAL'}
        />

        {/* `key` membuat seksi yang baru dipilih masuk dengan fade pendek. Ini
            memberi tahu bahwa isi panel berganti, bukan sekadar ter-update —
            penting karena tombol simpan tiap seksi berbeda. */}
        <div className='min-w-0'>
          <div
            key={activeTab.key}
            className='animate-in duration-200 ease-out fade-in motion-reduce:animate-none'
          >
            {activeTab.key === 'identity' && (
              <SectionPanel
                icon={Warehouse}
                title='Identitas gudang'
                description='Nama ini tercetak di tiket supir dan dipakai sebagai nama gudang pertama di Master Data. Keduanya ditulis bersamaan oleh server, jadi tidak mungkin berbeda.'
                error={sectionError('identity', form)}
                dirty={isDirty('identity', form, saved)}
                pending={save.isPending && save.variables === 'identity'}
                onSave={() => save.mutate('identity')}
                onReset={() => resetSection('identity')}
              >
                <FieldRow
                  label='Nama gudang'
                  htmlFor='warehouse-name'
                  hint='Minimal 2 karakter, maksimal 120. Nama gudang lain di Master Data tidak boleh sama.'
                >
                  <Input
                    id='warehouse-name'
                    value={form.warehouseName}
                    onChange={(event) =>
                      setField('warehouseName', event.target.value)
                    }
                    className='w-full sm:w-72'
                    maxLength={120}
                    autoComplete='off'
                  />
                </FieldRow>
              </SectionPanel>
            )}

            {activeTab.key === 'brand' && (
              <SectionPanel
                icon={Type}
                title='Identitas merek'
                description='Logo, judul, dan subjudul yang tampil di kepala sidebar, halaman masuk, dan judul tab peramban. Bukan nama gudang — identitas gudang tetap di seksi Identitas gudang.'
                error={sectionError('brand', form)}
                dirty={isDirty('brand', form, saved)}
                pending={save.isPending && save.variables === 'brand'}
                onSave={() => save.mutate('brand')}
                onReset={() => resetSection('brand')}
                footerNote='Berlaku untuk semua pengguna setelah disimpan. Halaman tiket supir tetap memakai nama perusahaan customer, bukan judul ini.'
              >
                <LogoField
                  logoUrl={form.appLogoUrl}
                  appName={form.appName}
                  onChange={setField}
                />

                <FieldRow
                  label='Judul aplikasi'
                  htmlFor='app-name'
                  hint='1–60 karakter. Huruf pertama dipakai sebagai lencana saat logo belum diunggah.'
                >
                  <Input
                    id='app-name'
                    value={form.appName}
                    onChange={(event) => setField('appName', event.target.value)}
                    className='w-full sm:w-72'
                    maxLength={60}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label='Subjudul'
                  htmlFor='app-tagline'
                  hint='Baris kecil di bawah judul. Boleh dikosongkan untuk menampilkan judul saja.'
                >
                  <Input
                    id='app-tagline'
                    value={form.appTagline}
                    onChange={(event) =>
                      setField('appTagline', event.target.value)
                    }
                    className='w-full sm:w-72'
                    maxLength={80}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label='Nama pendek'
                  htmlFor='app-short'
                  hint='Untuk judul tab peramban dan layar sempit. Kosongkan agar memakai judul aplikasi.'
                >
                  <Input
                    id='app-short'
                    value={form.appShortName}
                    onChange={(event) =>
                      setField('appShortName', event.target.value)
                    }
                    className='w-full sm:w-48'
                    maxLength={20}
                    placeholder='Opsional'
                    autoComplete='off'
                  />
                </FieldRow>

                <BrandPreview
                  appName={form.appName}
                  appTagline={form.appTagline}
                  appShortName={form.appShortName}
                  logoUrl={form.appLogoUrl}
                />
              </SectionPanel>
            )}

            {activeTab.key === 'login' && (
              <SectionPanel
                icon={LogIn}
                title='Halaman masuk'
                description='Kalimat sambutan dan tampilan panel kanan di halaman masuk. Yang diubah di sini hanya yang dilihat sebelum masuk.'
                error={sectionError('login', form)}
                dirty={isDirty('login', form, saved)}
                pending={save.isPending && save.variables === 'login'}
                onSave={() => save.mutate('login')}
                onReset={() => resetSection('login')}
                footerNote='Teks sambutan tampil juga di ponsel di bawah nama aplikasi; gambar panel hanya di layar lebar.'
              >
                <FieldRow
                  label='Teks sambutan'
                  htmlFor='login-description'
                  hint={`1–${LOGIN_DESCRIPTION_MAX} karakter. Kosongkan untuk memakai teks bawaan.`}
                >
                  <div className='flex w-full flex-col gap-1.5 sm:w-96'>
                    <textarea
                      id='login-description'
                      value={form.loginDescription}
                      onChange={(event) =>
                        setField('loginDescription', event.target.value)
                      }
                      maxLength={LOGIN_DESCRIPTION_MAX}
                      rows={3}
                      placeholder={DEFAULT_LOGIN_DESCRIPTION}
                      className='min-h-20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
                    />
                    <span className='self-end text-[11px] text-muted-foreground tabular-nums'>
                      {form.loginDescription.length}/{LOGIN_DESCRIPTION_MAX}
                    </span>
                  </div>
                </FieldRow>

                <LoginPanelFields
                  coverUrl={form.loginCoverUrl}
                  brandColor={form.loginBrandColor}
                  onChange={setField}
                />

                <LoginPreview
                  appName={form.appName}
                  appTagline={form.appTagline}
                  appLogoUrl={form.appLogoUrl}
                  description={form.loginDescription}
                />
              </SectionPanel>
            )}

            {activeTab.key === 'hours' && (
              <SectionPanel
                icon={Clock}
                title='Jam operasional'
                description='Menentukan slot mana yang bisa dipesan hari ini. Setiap blok dimulai dari jam buka, jadi rentangnya wajib habis dibagi satuan blok.'
                error={sectionError('hours', form)}
                dirty={isDirty('hours', form, saved)}
                pending={save.isPending && save.variables === 'hours'}
                onSave={() => save.mutate('hours')}
                onReset={() => resetSection('hours')}
                footerNote={`Kapasitas per blok saat ini ${settings.capacity?.LOADING ?? 0} loading dan ${settings.capacity?.UNLOADING ?? 0} unloading — mengikuti jumlah dock aktif di Master Data, bukan diatur di sini.`}
              >
                <FieldRow
                  label='Jam buka'
                  htmlFor='open'
                  hint='Blok pertama dimulai tepat pada jam ini.'
                >
                  <Input
                    id='open'
                    type='time'
                    value={form.open}
                    onChange={(event) => setField('open', event.target.value)}
                    className={cn(timeInputClass, 'w-32')}
                  />
                </FieldRow>

                <FieldRow
                  label='Jam tutup'
                  htmlFor='close'
                  hint='Tidak ada blok yang dimulai setelah jam ini; blok terakhir harus selesai tepat waktu.'
                >
                  <Input
                    id='close'
                    type='time'
                    value={form.close}
                    onChange={(event) => setField('close', event.target.value)}
                    className={cn(timeInputClass, 'w-32')}
                  />
                </FieldRow>

                <FieldRow
                  label='Satuan blok'
                  htmlFor='unit'
                  hint='Ukuran satu slot. Mengubahnya mengubah jumlah blok per hari dan seluruh ketersediaan; booking lama tetap memakai blok yang sudah dikunci.'
                >
                  <NumberField
                    id='unit'
                    value={form.slotUnitMinutes}
                    onChange={(value) => setField('slotUnitMinutes', value)}
                    min={15}
                    max={120}
                    step={15}
                    unit='menit'
                  />
                </FieldRow>

                <div className='mt-3 rounded-lg border border-dashed px-4 py-3 text-sm'>
                  <p className='text-muted-foreground'>
                    Rentang{' '}
                    <span className='font-medium text-foreground'>
                      {impact.hours}
                    </span>{' '}
                    ={' '}
                    <span className='font-medium text-foreground'>
                      {impact.duration}
                    </span>
                    , berisi{' '}
                    <span className='font-medium text-foreground'>
                      {impact.blocks}
                    </span>
                    .
                  </p>
                  {hoursNote(form.open, form.close, form.slotUnitMinutes) && (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {hoursNote(form.open, form.close, form.slotUnitMinutes)}
                    </p>
                  )}
                </div>
              </SectionPanel>
            )}

            {activeTab.key === 'arrival' && (
              <SectionPanel
                icon={Truck}
                title='Aturan kedatangan'
                description='Dua ambang ini dipakai petugas gate dan cron penanda tidak datang. Keduanya soal toleransi waktu, bukan kuota.'
                error={sectionError('arrival', form)}
                dirty={isDirty('arrival', form, saved)}
                pending={save.isPending && save.variables === 'arrival'}
                onSave={() => save.mutate('arrival')}
                onReset={() => resetSection('arrival')}
              >
                <FieldRow
                  label='Masa tenggang'
                  htmlFor='grace'
                  hint={`Truk yang datang dalam ${form.gracePeriodMinutes || '—'} menit setelah jadwal masih dihitung tepat waktu. Lewat dari itu masuk antrean terlambat.`}
                >
                  <NumberField
                    id='grace'
                    value={form.gracePeriodMinutes}
                    onChange={(value) => setField('gracePeriodMinutes', value)}
                    min={0}
                    max={240}
                    unit='menit'
                  />
                </FieldRow>

                <FieldRow
                  label='Batas datang awal'
                  htmlFor='early'
                  hint={`Gate-in ditolak bila truk datang lebih awal dari ${form.earlyArrivalLimitMinutes || '—'} menit sebelum jadwal.`}
                >
                  <NumberField
                    id='early'
                    value={form.earlyArrivalLimitMinutes}
                    onChange={(value) =>
                      setField('earlyArrivalLimitMinutes', value)
                    }
                    min={0}
                    max={480}
                    unit='menit'
                  />
                </FieldRow>

                {Number(form.earlyArrivalLimitMinutes) >
                  Number(form.gracePeriodMinutes) * 4 &&
                  Number(form.gracePeriodMinutes) > 0 && (
                    <p className='mt-3 text-xs text-amber-700 dark:text-amber-400'>
                      Batas datang awal jauh lebih longgar dari masa tenggang.
                      Truk bisa menumpuk di area tunggu sebelum slotnya dimulai.
                    </p>
                  )}
              </SectionPanel>
            )}

            {activeTab.key === 'window' && (
              <SectionPanel
                icon={CalendarClock}
                title='Jendela pemesanan'
                description='Seberapa jauh ke depan customer boleh memesan. Semakin panjang, semakin banyak slot yang harus disiapkan untuk setiap jenis aktivitas.'
                error={sectionError('window', form)}
                dirty={isDirty('window', form, saved)}
                pending={save.isPending && save.variables === 'window'}
                onSave={() => save.mutate('window')}
                onReset={() => resetSection('window')}
              >
                <FieldRow
                  label='Hari ke depan'
                  htmlFor='window'
                  hint='Hari ini ikut dihitung. Customer tidak bisa memesan di luar rentang ini, termasuk lewat tautan langsung.'
                >
                  <NumberField
                    id='window'
                    value={form.bookingWindowDays}
                    onChange={(value) => setField('bookingWindowDays', value)}
                    min={1}
                    max={90}
                    unit='hari'
                  />
                </FieldRow>

                <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                  {[
                    { label: 'Hari ini', days: 1 },
                    { label: 'Minggu ini', days: 7 },
                    { label: 'Se bulan', days: 30 },
                  ].map((preset) => {
                    const active =
                      Number(form.bookingWindowDays) === preset.days
                    return (
                      <button
                        key={preset.days}
                        type='button'
                        onClick={() =>
                          setField('bookingWindowDays', String(preset.days))
                        }
                        className={cn(
                          'rounded-md border px-3 py-2 text-start text-xs transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          active
                            ? 'border-primary bg-primary/5 font-medium'
                            : 'hover:border-foreground/25'
                        )}
                      >
                        <span className='block text-sm tabular-nums'>
                          {preset.days} hari
                        </span>
                        <span className='text-muted-foreground'>
                          {preset.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </SectionPanel>
            )}

            {activeTab.key === 'approval' && (
              <SectionPanel
                icon={ShieldCheck}
                title='Persetujuan booking'
                description='Mengubah siapa yang boleh booking tanpa antre. Setiap perubahan mode dicatat di jejak audit beserta admin yang melakukannya.'
                error={sectionError('approval', form)}
                dirty={isDirty('approval', form, saved)}
                pending={save.isPending && save.variables === 'approval'}
                onSave={() => save.mutate('approval')}
                onReset={() => resetSection('approval')}
              >
                <FieldRow
                  label='Mode'
                  htmlFor='approval-mode'
                  hint={
                    form.approvalMode === 'AUTO'
                      ? 'Setiap booking langsung sah dan langsung mengunci kuota slot.'
                      : 'Hanya customer bertanda "booking otomatis" di halaman Pengguna yang lolos; sisanya menunggu keputusan Admin.'
                  }
                >
                  <div className='flex flex-col gap-2 sm:items-end'>
                    <Select
                      value={form.approvalMode}
                      onValueChange={(value) =>
                        setField(
                          'approvalMode',
                          value as FormState['approvalMode']
                        )
                      }
                    >
                      <SelectTrigger
                        id='approval-mode'
                        className='w-full sm:w-72'
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AUTO'>
                          Otomatis — semua langsung disetujui
                        </SelectItem>
                        <SelectItem value='MANUAL'>
                          Manual — perlu persetujuan Admin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <PolicyFlag manual={form.approvalMode === 'MANUAL'} />
                  </div>
                </FieldRow>

                <FieldRow
                  label='Tenggat sebelum kedatangan'
                  htmlFor='approval-lead'
                  hint='Keputusan harus selesai sekian menit sebelum jam kedatangan, kalau tidak booking kedaluwarsa dan kuotanya dilepas.'
                >
                  <NumberField
                    id='approval-lead'
                    value={form.approvalLeadMinutes}
                    onChange={(value) => setField('approvalLeadMinutes', value)}
                    min={5}
                    max={2880}
                    unit='menit'
                    width='w-24'
                  />
                </FieldRow>

                <FieldRow
                  label='Jendela keputusan minimum'
                  htmlFor='approval-min'
                  hint='Booking mendesak tetap punya sekian menit untuk diputuskan, meski tenggat di atas sudah lewat.'
                >
                  <NumberField
                    id='approval-min'
                    value={form.approvalMinDecisionMinutes}
                    onChange={(value) =>
                      setField('approvalMinDecisionMinutes', value)
                    }
                    min={5}
                    max={1440}
                    unit='menit'
                    width='w-24'
                  />
                </FieldRow>

                <FieldRow
                  label='Ambang label mendesak'
                  htmlFor='approval-urgent'
                  hint='Hanya memengaruhi penanda di antrean admin, bukan keputusan atau kuota.'
                >
                  <NumberField
                    id='approval-urgent'
                    value={form.approvalUrgentBufferMinutes}
                    onChange={(value) =>
                      setField('approvalUrgentBufferMinutes', value)
                    }
                    min={0}
                    max={14400}
                    unit='menit'
                    width='w-24'
                  />
                </FieldRow>
              </SectionPanel>
            )}

            {activeTab.key === 'appearance' && (
              <SectionPanel
                icon={Palette}
                title='Tampilan'
                description='Preferensi peramban ini, bukan bagian dari pengaturan gudang. Tersimpan di perangkat Anda dan tidak ikut terkirim saat seksi lain disimpan.'
                footerNote='Bisa juga diubah dari menu Tema di kaki sidebar.'
              >
                <AppearancePicker />
              </SectionPanel>
            )}
          </div>
        </div>
      </div>
    </Main>
  )
}

/**
 * Pratinjau merek memakai ukuran dan pemotongan yang sama dengan tempat
 * aslinya — kepala sidebar 28 px dan ikon tab 16 px — supaya judul yang terlalu
 * panjang atau logo yang terlalu rinci terlihat bermasalah di sini, bukan
 * setelah disimpan dan semua orang melihatnya.
 */
function BrandPreview({
  appName,
  appTagline,
  appShortName,
  logoUrl,
}: {
  appName: string
  appTagline: string
  appShortName: string
  logoUrl: string
}) {
  const name = appName.trim() || '—'
  const short = appShortName.trim()
  return (
    <div className='mt-4 rounded-lg border border-dashed px-4 py-3'>
      <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        Pratinjau
      </p>

      {/* Kepala sidebar: satu-satunya tempat logo, judul, dan subjudul tampil
          berdampingan, dan ruangnya paling sempit. */}
      <div className='mt-2 flex items-center gap-2 rounded-md border bg-sidebar px-3 py-2'>
        <BrandLogo name={name} logoUrl={logoUrl.trim() || null} size={28} />
        <div className='grid min-w-0 leading-tight'>
          <span className='truncate font-bold'>{name}</span>
          {appTagline.trim() && (
            <span className='truncate text-xs text-muted-foreground'>
              {appTagline.trim()}
            </span>
          )}
        </div>
      </div>

      {/* Tab peramban: ikon 16 px dan judul. */}
      <div className='mt-3 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5'>
        <BrandLogo name={name} logoUrl={logoUrl.trim() || null} size={16} />
        <span className='truncate text-xs text-muted-foreground'>
          {tabTitle(name, short || null)}
        </span>
        <span className='ms-auto text-[10px] text-muted-foreground/70'>×</span>
      </div>

      <p className='mt-3 text-xs text-muted-foreground'>
        Nama pendek dipakai sebagai judul tab; kalau kosong, judul aplikasi yang
        dipakai.
      </p>
    </div>
  )
}

const MESSAGE_BY_SECTION: Record<SectionKey, string> = {
  identity: 'Identitas gudang disimpan',
  brand: 'Identitas merek disimpan',
  login: 'Halaman masuk disimpan',
  hours: 'Jam operasional disimpan',
  arrival: 'Aturan kedatangan disimpan',
  window: 'Jendela pemesanan disimpan',
  approval: 'Kebijakan persetujuan disimpan',
}

/**
 * Navigasi seksi. Vertikal dan menempel di layar besar; di layar kecil menjadi
 * deretan chip yang bisa digeser, bukan dropdown — label seksi perlu terlihat
 * sekaligus untuk memberi gambaran isi halaman.
 */
function SectionNav({
  active,
  onSelect,
  dirty,
  manual,
}: {
  active: Tab
  onSelect: (tab: Tab) => void
  dirty: SectionKey[]
  manual: boolean
}) {
  const groups = [...new Set(TABS.map((item) => item.group))]

  return (
    <nav
      aria-label='Seksi pengaturan'
      className='min-w-0 lg:sticky lg:top-4 lg:self-start'
    >
      {/* Di layar kecil nav menjadi baris chip yang digeser. Tepi kanan diberi
          mask supaya jelas masih ada seksi lain di luar layar — tanpa itu chip
          terpotong begitu saja dan tampak seperti daftar yang sudah habis. */}
      <div className='-mx-1 flex gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%_-_2rem),transparent)] px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:[mask-image:none] lg:px-0 lg:pb-0'>
        {groups.map((group) => (
          <div key={group} className='contents lg:block'>
            <p className='hidden px-2 pt-4 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase first:pt-0 lg:block'>
              {group}
            </p>
            {TABS.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon
              const isActive = active === item.key
              const isDirty = (dirty as string[]).includes(item.key)

              return (
                <button
                  key={item.key}
                  type='button'
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm whitespace-nowrap transition-colors duration-150 outline-none',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    isActive
                      ? 'bg-secondary font-medium text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className='size-4 shrink-0' aria-hidden />
                  {item.label}
                  {item.key === 'approval' && manual && (
                    <span
                      className='size-1.5 rounded-full bg-amber-500'
                      title='Mode manual aktif'
                    />
                  )}
                  {isDirty && (
                    <span
                      className='size-1.5 rounded-full bg-amber-500 lg:ms-auto'
                      title='Belum disimpan'
                    />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className='mt-4 hidden rounded-lg border border-dashed px-3 py-2.5 lg:block'>
        <p className='text-[11px] leading-relaxed text-muted-foreground'>
          {dirty.length === 0
            ? 'Tidak ada perubahan tertunda. Setiap seksi disimpan sendiri.'
            : `${dirty.length} seksi berubah dan belum dikirim ke server.`}
        </p>
      </div>
    </nav>
  )
}
