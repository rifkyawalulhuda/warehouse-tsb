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
 */
export async function settingsPayload() {
  const settings = await getSettings()
  const [truckTypes, capacities] = await Promise.all([
    prisma.truckType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    capacityMap(),
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
    capacity: capacities,
    blocksPerDay: listBlockStarts(window).length,
    truckTypes,
  }
}
