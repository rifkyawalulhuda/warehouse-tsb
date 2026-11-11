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
  Users,
  Warehouse,
} from 'lucide-react'
import type { Role } from '@/lib/api/types'
import type { NavGroup, SidebarData } from '../types'

const customerNav: NavGroup[] = [
  {
    title: 'Booking',
    items: [
      { title: 'Jadwal Saya', url: '/bookings', icon: CalendarClock },
      { title: 'Buat Booking', url: '/bookings/new', icon: ClipboardList },
      { title: 'Laporan', url: '/reports/customer', icon: BarChart3 },
    ],
  },
]

const gateNav: NavGroup[] = [
  {
    title: 'Gate',
    items: [
      { title: 'Scan Gate', url: '/scan', icon: ScanLine },
      { title: 'Riwayat Gate', url: '/history', icon: History },
    ],
  },
]

const checkerNav: NavGroup[] = [
  {
    title: 'Operasional',
    items: [
      { title: 'Scan Checker', url: '/checker/scan', icon: QrCode },
      { title: 'Antrean Hari Ini', url: '/queue', icon: ListChecks },
      { title: 'Papan Dock', url: '/dock', icon: Truck },
      { title: 'Riwayat Gate', url: '/history', icon: History },
    ],
  },
  {
    title: 'Lainnya',
    items: [{ title: 'Laporan', url: '/reports', icon: BarChart3 }],
  },
]

const adminNav: NavGroup[] = [
  {
    title: 'Operasional',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Antrean Hari Ini', url: '/queue', icon: ListChecks },
      { title: 'Papan Dock', url: '/dock', icon: Truck },
      { title: 'Scan Checker', url: '/checker/scan', icon: QrCode },
      { title: 'Scan Gate', url: '/scan', icon: ScanLine },
      { title: 'Riwayat Gate', url: '/history', icon: History },
    ],
  },
  {
    title: 'Manajemen',
    items: [
      { title: 'Laporan', url: '/reports', icon: BarChart3 },
      { title: 'Master Data', url: '/master', icon: Warehouse },
      { title: 'Pengguna', url: '/users', icon: Users },
      { title: 'Pengaturan', url: '/settings', icon: Settings },
    ],
  },
]

export function navGroupsForRole(role: Role | null): NavGroup[] {
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

export function buildSidebarData(
  role: Role | null,
  user: { name: string; email: string; company?: string }
): SidebarData {
  return {
    user: { ...user, avatar: '' },
    teams: [],
    navGroups: navGroupsForRole(role),
  }
}
