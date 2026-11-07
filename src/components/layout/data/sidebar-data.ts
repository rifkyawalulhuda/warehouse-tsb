import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
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
    ],
  },
]

const gateNav: NavGroup[] = [
  {
    title: 'Gate',
    items: [{ title: 'Scan Gate', url: '/scan', icon: ScanLine }],
  },
]

const checkerNav: NavGroup[] = [
  {
    title: 'Operasional',
    items: [
      { title: 'Antrean Hari Ini', url: '/queue', icon: ListChecks },
      { title: 'Papan Dock', url: '/dock', icon: Truck },
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
      { title: 'Scan Gate', url: '/scan', icon: ScanLine },
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
  user: { name: string; email: string }
): SidebarData {
  return {
    user: { ...user, avatar: '' },
    teams: [],
    navGroups: navGroupsForRole(role),
  }
}
