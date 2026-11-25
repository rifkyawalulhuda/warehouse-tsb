import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Clock,
  Languages,
  LogIn,
  Palette,
  ShieldCheck,
  Ticket,
  Truck,
  Type,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api/client'
import { fetchSettings, saveSettings } from '@/lib/api/endpoints'
import type { Settings } from '@/lib/api/types'
import { tabTitle } from '@/lib/branding'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BrandLogo } from '@/components/brand-logo'
import { Main } from '@/components/layout/main'
import { LocaleSwitch } from '@/components/locale-switch'
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
import { LoginPanelFields } from './login-panel-fields'
import { LoginPreview } from './login-preview'
import { LogoField } from './logo-field'
import { OperationsSummary, PolicyFlag } from './operations-summary'
import { FieldRow, NumberField, SectionPanel } from './section-panel'
import { TicketDesignPicker } from './ticket-design-picker'

type Tab = SectionKey | 'appearance' | 'language'

const TABS: {
  key: Tab
  labelKey: MessageKey
  icon: LucideIcon
  groupKey: MessageKey
}[] = [
  {
    key: 'identity',
    labelKey: 'settings.tab.identity',
    icon: Warehouse,
    groupKey: 'settings.group.warehouse',
  },
  {
    key: 'brand',
    labelKey: 'settings.tab.brand',
    icon: Type,
    groupKey: 'settings.group.brand',
  },
  {
    key: 'login',
    labelKey: 'settings.tab.login',
    icon: LogIn,
    groupKey: 'settings.group.brand',
  },
  {
    key: 'hours',
    labelKey: 'settings.tab.hours',
    icon: Clock,
    groupKey: 'settings.group.operations',
  },
  {
    key: 'arrival',
    labelKey: 'settings.tab.arrival',
    icon: Truck,
    groupKey: 'settings.group.operations',
  },
  {
    key: 'window',
    labelKey: 'settings.tab.window',
    icon: CalendarClock,
    groupKey: 'settings.group.policy',
  },
  {
    key: 'approval',
    labelKey: 'settings.tab.approval',
    icon: ShieldCheck,
    groupKey: 'settings.group.policy',
  },
  {
    key: 'language',
    labelKey: 'settings.tab.language',
    icon: Languages,
    groupKey: 'settings.group.preferences',
  },
  {
    key: 'ticket',
    labelKey: 'settings.tab.ticket',
    icon: Ticket,
    groupKey: 'settings.group.preferences',
  },
  {
    key: 'appearance',
    labelKey: 'settings.tab.appearance',
    icon: Palette,
    groupKey: 'settings.group.preferences',
  },
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
  const t = useT()
  const settings = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })

  if (settings.isPending) return <LoadingBlock label={t('settings.loading')} />
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
  const t = useT()
  const queryClient = useQueryClient()
  // Salinan draf awal. `toForm` murah dan hanya bergantung pada `settings`,
  // yang nilainya tetap selama komponen ini hidup (parent memberi `key` baru
  // setiap data server berubah).
  const [saved] = useState<FormState>(() => toForm(settings))
  const [form, setForm] = useState<FormState>(saved)
  const [tab, setTab] = useState<Tab>('hours')

  const dirty = dirtySections(form, saved)
  const impact = impactOf(form, t)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const save = useMutation({
    mutationFn: (section: SectionKey) =>
      saveSettings(sectionPayload(section, form)),
    onSuccess: (_data, section) => {
      toast.success(t(MESSAGE_BY_SECTION[section]))
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
        title={t('settings.title')}
        description={t('settings.description')}
        actions={
          <span className='flex items-center gap-2 text-xs text-muted-foreground'>
            {dirty.length === 0 ? (
              <>
                <span
                  className='size-1.5 rounded-full bg-emerald-500'
                  aria-hidden
                />
                {t('settings.allSaved')}
              </>
            ) : (
              <>
                <span
                  className='size-1.5 rounded-full bg-amber-500'
                  aria-hidden
                />
                {t('settings.dirtyCount', { count: dirty.length })}
              </>
            )}
          </span>
        }
      />

      <OperationsSummary
        impact={impact}
        saved={impactOf(saved, t)}
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
                title={t('settings.identity.title')}
                description={t('settings.identity.description')}
                error={sectionError('identity', form, t)}
                dirty={isDirty('identity', form, saved)}
                pending={save.isPending && save.variables === 'identity'}
                onSave={() => save.mutate('identity')}
                onReset={() => resetSection('identity')}
              >
                <FieldRow
                  label={t('settings.identity.name')}
                  htmlFor='warehouse-name'
                  hint={t('settings.identity.nameHint')}
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
                title={t('settings.brand.title')}
                description={t('settings.brand.description')}
                error={sectionError('brand', form, t)}
                dirty={isDirty('brand', form, saved)}
                pending={save.isPending && save.variables === 'brand'}
                onSave={() => save.mutate('brand')}
                onReset={() => resetSection('brand')}
                footerNote={t('settings.brand.footer')}
              >
                <LogoField
                  logoUrl={form.appLogoUrl}
                  appName={form.appName}
                  onChange={setField}
                />

                <FieldRow
                  label={t('settings.brand.appName')}
                  htmlFor='app-name'
                  hint={t('settings.brand.appNameHint')}
                >
                  <Input
                    id='app-name'
                    value={form.appName}
                    onChange={(event) =>
                      setField('appName', event.target.value)
                    }
                    className='w-full sm:w-72'
                    maxLength={60}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.brand.tagline')}
                  htmlFor='app-tagline'
                  hint={t('settings.brand.taglineHint')}
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
                  label={t('settings.brand.shortName')}
                  htmlFor='app-short'
                  hint={t('settings.brand.shortNameHint')}
                >
                  <Input
                    id='app-short'
                    value={form.appShortName}
                    onChange={(event) =>
                      setField('appShortName', event.target.value)
                    }
                    className='w-full sm:w-48'
                    maxLength={20}
                    placeholder={t('settings.brand.optional')}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.brand.footerCompany')}
                  htmlFor='footer-company'
                  hint={t('settings.brand.footerCompanyHint')}
                >
                  <Input
                    id='footer-company'
                    value={form.footerCompany}
                    onChange={(event) =>
                      setField('footerCompany', event.target.value)
                    }
                    className='w-full sm:w-96'
                    maxLength={200}
                    placeholder={t('footer.company')}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.brand.footerLocation')}
                  htmlFor='footer-location'
                  hint={t('settings.brand.footerLocationHint')}
                >
                  <Input
                    id='footer-location'
                    value={form.footerLocation}
                    onChange={(event) =>
                      setField('footerLocation', event.target.value)
                    }
                    className='w-full sm:w-72'
                    maxLength={120}
                    placeholder={t('footer.location')}
                    autoComplete='off'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.brand.footerShowLocation')}
                  hint={t('settings.brand.footerShowLocationHint')}
                >
                  <Switch
                    checked={form.footerShowLocation}
                    onCheckedChange={(checked) =>
                      setField('footerShowLocation', checked)
                    }
                    aria-label={t('settings.brand.footerShowLocation')}
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
                title={t('settings.login.title')}
                description={t('settings.login.description')}
                error={sectionError('login', form, t)}
                dirty={isDirty('login', form, saved)}
                pending={save.isPending && save.variables === 'login'}
                onSave={() => save.mutate('login')}
                onReset={() => resetSection('login')}
                footerNote={t('settings.login.footer')}
              >
                <FieldRow
                  label={t('settings.login.descriptionLabel')}
                  htmlFor='login-description'
                  hint={t('settings.login.descriptionHint', {
                    max: LOGIN_DESCRIPTION_MAX,
                  })}
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
                      placeholder={t('auth.defaultLoginDescription')}
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
                title={t('settings.hours.title')}
                description={t('settings.hours.description')}
                error={sectionError('hours', form, t)}
                dirty={isDirty('hours', form, saved)}
                pending={save.isPending && save.variables === 'hours'}
                onSave={() => save.mutate('hours')}
                onReset={() => resetSection('hours')}
                footerNote={t('settings.hours.footer', {
                  loading: settings.capacity?.LOADING ?? 0,
                  unloading: settings.capacity?.UNLOADING ?? 0,
                })}
              >
                <FieldRow
                  label={t('settings.hours.open')}
                  htmlFor='open'
                  hint={t('settings.hours.openHint')}
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
                  label={t('settings.hours.close')}
                  htmlFor='close'
                  hint={t('settings.hours.closeHint')}
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
                  label={t('settings.hours.unit')}
                  htmlFor='unit'
                  hint={t('settings.hours.unitHint')}
                >
                  <NumberField
                    id='unit'
                    value={form.slotUnitMinutes}
                    onChange={(value) => setField('slotUnitMinutes', value)}
                    min={15}
                    max={120}
                    step={15}
                    unit={t('settings.unit.minutes')}
                  />
                </FieldRow>

                <div className='mt-3 rounded-lg border border-dashed px-4 py-3 text-sm'>
                  <p className='text-muted-foreground'>
                    {t('settings.hours.summary', {
                      hours: impact.hours,
                      duration: impact.duration,
                      blocks: impact.blocks,
                    })}
                  </p>
                  {hoursNote(
                    form.open,
                    form.close,
                    form.slotUnitMinutes,
                    t
                  ) && (
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {hoursNote(
                        form.open,
                        form.close,
                        form.slotUnitMinutes,
                        t
                      )}
                    </p>
                  )}
                </div>
              </SectionPanel>
            )}

            {activeTab.key === 'arrival' && (
              <SectionPanel
                icon={Truck}
                title={t('settings.arrival.title')}
                description={t('settings.arrival.description')}
                error={sectionError('arrival', form, t)}
                dirty={isDirty('arrival', form, saved)}
                pending={save.isPending && save.variables === 'arrival'}
                onSave={() => save.mutate('arrival')}
                onReset={() => resetSection('arrival')}
              >
                <FieldRow
                  label={t('settings.arrival.grace')}
                  htmlFor='grace'
                  hint={t('settings.arrival.graceHint', {
                    minutes: form.gracePeriodMinutes || '—',
                  })}
                >
                  <NumberField
                    id='grace'
                    value={form.gracePeriodMinutes}
                    onChange={(value) => setField('gracePeriodMinutes', value)}
                    min={0}
                    max={240}
                    unit={t('settings.unit.minutes')}
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.arrival.early')}
                  htmlFor='early'
                  hint={t('settings.arrival.earlyHint', {
                    minutes: form.earlyArrivalLimitMinutes || '—',
                  })}
                >
                  <NumberField
                    id='early'
                    value={form.earlyArrivalLimitMinutes}
                    onChange={(value) =>
                      setField('earlyArrivalLimitMinutes', value)
                    }
                    min={0}
                    max={480}
                    unit={t('settings.unit.minutes')}
                  />
                </FieldRow>

                {Number(form.earlyArrivalLimitMinutes) >
                  Number(form.gracePeriodMinutes) * 4 &&
                  Number(form.gracePeriodMinutes) > 0 && (
                    <p className='mt-3 text-xs text-amber-700 dark:text-amber-400'>
                      {t('settings.arrival.warning')}
                    </p>
                  )}
              </SectionPanel>
            )}

            {activeTab.key === 'window' && (
              <SectionPanel
                icon={CalendarClock}
                title={t('settings.window.title')}
                description={t('settings.window.description')}
                error={sectionError('window', form, t)}
                dirty={isDirty('window', form, saved)}
                pending={save.isPending && save.variables === 'window'}
                onSave={() => save.mutate('window')}
                onReset={() => resetSection('window')}
              >
                <FieldRow
                  label={t('settings.window.days')}
                  htmlFor='window'
                  hint={t('settings.window.daysHint')}
                >
                  <NumberField
                    id='window'
                    value={form.bookingWindowDays}
                    onChange={(value) => setField('bookingWindowDays', value)}
                    min={1}
                    max={90}
                    unit={t('settings.unit.days')}
                  />
                </FieldRow>

                <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                  {[
                    { label: t('settings.window.today'), days: 1 },
                    { label: t('settings.window.thisWeek'), days: 7 },
                    { label: t('settings.window.thisMonth'), days: 30 },
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
                          {t('settings.window.daysUnit', {
                            count: preset.days,
                          })}
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
                title={t('settings.approval.title')}
                description={t('settings.approval.description')}
                error={sectionError('approval', form, t)}
                dirty={isDirty('approval', form, saved)}
                pending={save.isPending && save.variables === 'approval'}
                onSave={() => save.mutate('approval')}
                onReset={() => resetSection('approval')}
              >
                <FieldRow
                  label={t('settings.approval.mode')}
                  htmlFor='approval-mode'
                  hint={
                    form.approvalMode === 'AUTO'
                      ? t('settings.approval.modeAutoHint')
                      : t('settings.approval.modeManualHint')
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
                          {t('settings.approval.modeAuto')}
                        </SelectItem>
                        <SelectItem value='MANUAL'>
                          {t('settings.approval.modeManual')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <PolicyFlag manual={form.approvalMode === 'MANUAL'} />
                  </div>
                </FieldRow>

                <FieldRow
                  label={t('settings.approval.lead')}
                  htmlFor='approval-lead'
                  hint={t('settings.approval.leadHint')}
                >
                  <NumberField
                    id='approval-lead'
                    value={form.approvalLeadMinutes}
                    onChange={(value) => setField('approvalLeadMinutes', value)}
                    min={5}
                    max={2880}
                    unit={t('settings.unit.minutes')}
                    width='w-24'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.approval.minDecision')}
                  htmlFor='approval-min'
                  hint={t('settings.approval.minDecisionHint')}
                >
                  <NumberField
                    id='approval-min'
                    value={form.approvalMinDecisionMinutes}
                    onChange={(value) =>
                      setField('approvalMinDecisionMinutes', value)
                    }
                    min={5}
                    max={1440}
                    unit={t('settings.unit.minutes')}
                    width='w-24'
                  />
                </FieldRow>

                <FieldRow
                  label={t('settings.approval.urgent')}
                  htmlFor='approval-urgent'
                  hint={t('settings.approval.urgentHint')}
                >
                  <NumberField
                    id='approval-urgent'
                    value={form.approvalUrgentBufferMinutes}
                    onChange={(value) =>
                      setField('approvalUrgentBufferMinutes', value)
                    }
                    min={0}
                    max={14400}
                    unit={t('settings.unit.minutes')}
                    width='w-24'
                  />
                </FieldRow>
              </SectionPanel>
            )}

            {activeTab.key === 'language' && (
              <SectionPanel
                icon={Languages}
                title={t('settings.language.title')}
                description={t('settings.language.description')}
                footerNote={t('settings.language.footer')}
              >
                <LocaleSwitch variant='full' />
              </SectionPanel>
            )}

            {activeTab.key === 'appearance' && (
              <SectionPanel
                icon={Palette}
                title={t('settings.appearance.title')}
                description={t('settings.appearance.description')}
                footerNote={t('settings.appearance.footer')}
              >
                <AppearancePicker />
              </SectionPanel>
            )}

            {activeTab.key === 'ticket' && (
              <SectionPanel
                icon={Ticket}
                title={t('settings.ticket.title')}
                description={t('settings.ticket.description')}
                error={sectionError('ticket', form, t)}
                dirty={isDirty('ticket', form, saved)}
                pending={save.isPending && save.variables === 'ticket'}
                onSave={() => save.mutate('ticket')}
                onReset={() => resetSection('ticket')}
                footerNote={t('settings.ticket.footer')}
              >
                <TicketDesignPicker
                  value={form.ticketDesign}
                  onChange={(design) => setField('ticketDesign', design)}
                  appName={form.appName}
                  logoUrl={form.appLogoUrl.trim() || null}
                  brandColor={form.loginBrandColor.trim() || null}
                />
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
  const t = useT()
  const name = appName.trim() || '—'
  const short = appShortName.trim()
  return (
    <div className='mt-4 rounded-lg border border-dashed px-4 py-3'>
      <p className='text-[11px] font-medium tracking-wide text-muted-foreground uppercase'>
        {t('settings.brand.preview')}
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
        {t('settings.brand.previewNote')}
      </p>
    </div>
  )
}

const MESSAGE_BY_SECTION: Record<SectionKey, MessageKey> = {
  identity: 'settings.saved.identity',
  brand: 'settings.saved.brand',
  login: 'settings.saved.login',
  hours: 'settings.saved.hours',
  arrival: 'settings.saved.arrival',
  window: 'settings.saved.window',
  approval: 'settings.saved.approval',
  ticket: 'settings.saved.ticket',
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
  const t = useT()
  const groups = [...new Set(TABS.map((item) => item.groupKey))]

  return (
    <nav
      aria-label={t('settings.navAria')}
      className='min-w-0 lg:sticky lg:top-4 lg:self-start'
    >
      {/* Di layar kecil nav menjadi baris chip yang digeser. Tepi kanan diberi
          mask supaya jelas masih ada seksi lain di luar layar — tanpa itu chip
          terpotong begitu saja dan tampak seperti daftar yang sudah habis. */}
      <div className='-mx-1 flex gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%_-_2rem),transparent)] px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:[mask-image:none] lg:px-0 lg:pb-0'>
        {groups.map((group) => (
          <div key={group} className='contents lg:block'>
            <p className='hidden px-2 pt-4 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase first:pt-0 lg:block'>
              {t(group)}
            </p>
            {TABS.filter((item) => item.groupKey === group).map((item) => {
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
                  {t(item.labelKey)}
                  {item.key === 'approval' && manual && (
                    <span
                      className='size-1.5 rounded-full bg-amber-500'
                      title={t('settings.manualModeOn')}
                    />
                  )}
                  {isDirty && (
                    <span
                      className='size-1.5 rounded-full bg-amber-500 lg:ms-auto'
                      title={t('settings.unsaved')}
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
            ? t('settings.navEmpty')
            : t('settings.navDirty', { count: dirty.length })}
        </p>
      </div>
    </nav>
  )
}
