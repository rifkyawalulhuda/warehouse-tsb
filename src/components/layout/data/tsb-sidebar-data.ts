import {
  BarChart3,
  Bell,
  CalendarClock,
  Container,
  Gauge,
  LayoutDashboard,
  Settings,
  Timer,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const tsbSidebarData: SidebarData = {
  user: {
    name: 'Rina Kusuma',
    email: 'rina.kusuma@sankyu.co.id',
    // catatan: avatar inisial mengikuti NavUser bawaan template ('SN' = Sat Naing),
    // ganti berkas /avatars/shadcn.jpg untuk branding TSB.
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Gudang Cikarang',
      logo: Warehouse,
      plan: 'TSB · Shift 1',
    },
    {
      name: 'Gudang Cibitung',
      logo: Container,
      plan: 'TSB · Shift 2',
    },
  ],
  navGroups: [
    {
      title: 'Operasional',
      items: [
        { title: 'Dashboard', url: '/tsb-admin', icon: LayoutDashboard },
        {
          title: 'Jadwal & Booking',
          url: '/tsb-admin',
          icon: CalendarClock,
          badge: '42',
        },
        {
          title: 'Antrean Terlambat',
          url: '/tsb-admin',
          icon: Timer,
          badge: '3',
        },
        { title: 'Monitoring Dock', url: '/tsb-admin', icon: Gauge },
      ],
    },
    {
      title: 'Master Data',
      items: [
        { title: 'Customer / Ekspedisi', url: '/tsb-admin', icon: Users },
        { title: 'Armada & Supir', url: '/tsb-admin', icon: Truck },
        { title: 'Dock & Kapasitas', url: '/tsb-admin', icon: Warehouse },
      ],
    },
    {
      title: 'Lainnya',
      items: [
        { title: 'Laporan & KPI', url: '/tsb-admin', icon: BarChart3 },
        { title: 'Notifikasi', url: '/tsb-admin', icon: Bell },
        { title: 'Pengaturan', url: '/tsb-admin', icon: Settings },
      ],
    },
  ],
}
