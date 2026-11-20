import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  History,
  LayoutDashboard,
  ListChecks,
  QrCode,
  ScanLine,
  Settings,
  Truck,
  Warehouse,
} from 'lucide-react'
import type { Role } from '@/lib/api/types'
import { getLocale } from '@/lib/i18n'
import { translate, type MessageKey } from '@/lib/i18n/translate'
import type { NavGroup, SidebarData } from '../types'

/**
 * Menu ditulis sebagai kunci kamus, bukan teks, supaya judulnya ikut bahasa
 * aktif. Struktur menu sama untuk semua bahasa; hanya labelnya yang diterjemahkan
 * saat data dibangun.
 */
type NavGroupDefinition = Omit<NavGroup, 'title' | 'items'> & {
  titleKey: MessageKey
  items: (Omit<NavGroup['items'][number], 'title'> & { titleKey: MessageKey })[]
}

const customerNav: NavGroupDefinition[] = [
  {
    titleKey: 'nav.booking',
    items: [
      { titleKey: 'nav.myBookings', url: '/bookings', icon: CalendarClock },
      { titleKey: 'nav.newBooking', url: '/bookings/new', icon: ClipboardList },
      { titleKey: 'nav.reports', url: '/reports/customer', icon: BarChart3 },
    ],
  },
]

const gateNav: NavGroupDefinition[] = [
  {
    titleKey: 'nav.gate',
    items: [
      { titleKey: 'nav.scanGate', url: '/scan', icon: ScanLine },
      { titleKey: 'nav.gateHistory', url: '/history', icon: History },
    ],
  },
]

const checkerNav: NavGroupDefinition[] = [
  {
    titleKey: 'nav.operations',
    items: [
      { titleKey: 'nav.checkerScan', url: '/checker/scan', icon: QrCode },
      { titleKey: 'nav.todayQueue', url: '/queue', icon: ListChecks },
      { titleKey: 'nav.dockBoard', url: '/dock', icon: Truck },
      { titleKey: 'nav.gateHistory', url: '/history', icon: History },
    ],
  },
  {
    titleKey: 'nav.other',
    items: [{ titleKey: 'nav.reports', url: '/reports', icon: BarChart3 }],
  },
]

const adminNav: NavGroupDefinition[] = [
  {
    titleKey: 'nav.operations',
    items: [
      { titleKey: 'nav.dashboard', url: '/dashboard', icon: LayoutDashboard },
      { titleKey: 'nav.todayQueue', url: '/queue', icon: ListChecks },
      { titleKey: 'nav.dockBoard', url: '/dock', icon: Truck },
      { titleKey: 'nav.checkerScan', url: '/checker/scan', icon: QrCode },
      { titleKey: 'nav.scanGate', url: '/scan', icon: ScanLine },
      { titleKey: 'nav.gateHistory', url: '/history', icon: History },
    ],
  },
  {
    titleKey: 'nav.management',
    items: [
      { titleKey: 'nav.reports', url: '/reports', icon: BarChart3 },
      // Akun staf dan akun customer sama-sama dikelola dari Master Data.
      // Rute /users masih hidup untuk tautan lama, tetapi bukan menu.
      { titleKey: 'nav.masterData', url: '/master', icon: Warehouse },
      { titleKey: 'nav.settings', url: '/settings', icon: Settings },
    ],
  },
]

function navDefinitionsForRole(role: Role | null): NavGroupDefinition[] {
  switch (role) {
    case 'CUSTOMER':
      return customerNav
    case 'GATE_OFFICER':
      return gateNav
    case 'CHECKER':
      return checkerNav
    case 'ADMIN':
      return adminNav
    default:
      return []
  }
}

/**
 * Daftar menu tanpa data pengguna. Dipakai lembar menu ponsel dan pengujian.
 */
export function navGroupsForRole(role: Role | null): NavGroup[] {
  const locale = getLocale()
  return navDefinitionsForRole(role).map((group) => ({
    title: translate(locale, group.titleKey),
    items: group.items.map((item) => ({
      title: translate(locale, item.titleKey),
      url: item.url,
      icon: item.icon,
    })),
  }))
}

/**
 * Menu sidebar untuk satu peran.
 *
 * `pendingApprovals` menandai menu Antrean Hari Ini, karena antrean
 * persetujuan hidup sebagai tab di dalam layar itu — bukan menu tersendiri.
 * Penandanya sengaja hanya isyarat: tujuan menu tidak diubah, jadi Checker
 * tetap mendarat di tab Antrean seperti biasa.
 *
 * Judul diterjemahkan di sini agar seluruh pemakai `SidebarData` (sidebar
 * desktop, lembar menu ponsel, menu perintah) memakai label yang sama.
 */
export function buildSidebarData(
  role: Role | null,
  user: { name: string; email: string; company?: string },
  options: { pendingApprovals?: number } = {}
): SidebarData {
  const pending = options.pendingApprovals ?? 0

  return {
    user: { ...user, avatar: '' },
    teams: [],
    navGroups: navGroupsForRole(role).map((group) => ({
      ...group,
      items: group.items.map((item) =>
        pending > 0 && item.url === '/queue'
          ? { ...item, attention: pending }
          : item
      ),
    })),
  }
}
