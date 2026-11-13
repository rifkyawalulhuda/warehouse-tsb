import { prisma } from '../../lib/prisma'
import { capacityMap, getSettings, toWindow } from '../../lib/settings'
import { listBlockStarts, minuteToLabel } from '../../lib/quota'

/**
 * Satu bentuk respons untuk GET dan PUT supaya UI tidak perlu dua tipe.
 *
 * Yang dikirim adalah gabungan dua sumber: baris `warehouse_settings` dan
 * hitungan yang diturunkan darinya (`capacity`, `blocksPerDay`, label jam).
 * Turunan itu sengaja tidak disimpan, agar angka di layar tidak pernah berbeda
 * dari yang dipakai mesin kuota.
 *
 * `includeInternal: false` (dipakai untuk CUSTOMER) membuang angka perencanaan
 * gudang: kapasitas per aktivitas dan jumlah blok per hari. Keduanya hanya
 * dibaca layar staf (dashboard dan pengaturan); customer tetap menerima jam
 * operasional, aturan kedatangan, dan jenis truk yang ia butuhkan untuk
 * memesan. Sisa slot yang memang perlu ia lihat datang dari endpoint
 * ketersediaan, bukan dari sini.
 */
export async function settingsPayload(options: { includeInternal?: boolean } = {}) {
  const { includeInternal = true } = options
  const settings = await getSettings()
  const [truckTypes, capacities] = await Promise.all([
    prisma.truckType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    includeInternal ? capacityMap() : null,
  ])

  const window = toWindow(settings)

  return {
    warehouseName: settings.warehouseName,
    appName: settings.appName,
    appTagline: settings.appTagline,
    appShortName: settings.appShortName,
    appLogoUrl: settings.appLogoUrl,
    loginDescription: settings.loginDescription,
    loginCoverUrl: settings.loginCoverUrl,
    loginBrandColor: settings.loginBrandColor,
    operatingStartMinute: settings.operatingStartMinute,
    operatingEndMinute: settings.operatingEndMinute,
    operatingStartLabel: minuteToLabel(settings.operatingStartMinute),
    operatingEndLabel: minuteToLabel(settings.operatingEndMinute),
    slotUnitMinutes: settings.slotUnitMinutes,
    gracePeriodMinutes: settings.gracePeriodMinutes,
    earlyArrivalLimitMinutes: settings.earlyArrivalLimitMinutes,
    bookingWindowDays: settings.bookingWindowDays,
    approvalMode: settings.approvalMode,
    approvalLeadMinutes: settings.approvalLeadMinutes,
    approvalMinDecisionMinutes: settings.approvalMinDecisionMinutes,
    approvalUrgentBufferMinutes: settings.approvalUrgentBufferMinutes,
    ...(capacities
      ? { capacity: capacities, blocksPerDay: listBlockStarts(window).length }
      : {}),
    truckTypes,
  }
}
