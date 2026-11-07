export type Role = 'ADMIN' | 'CUSTOMER' | 'GATE_OFFICER' | 'CHECKER'

export type ActivityType = 'LOADING' | 'UNLOADING'

export type BookingStatus =
  | 'BOOKED_INCOMPLETE'
  | 'BOOKED_READY'
  | 'CHECKED_IN_ON_TIME'
  | 'LATE_WAITING_LIST'
  | 'DOCK_ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW'

export type DockActivity = 'LOADING' | 'UNLOADING' | 'BOTH'
export type DockStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  companyName: string | null
}

export type TruckType = {
  id: number
  truckName: string
  durationMinutes: number
  blocksRequired: number
  isActive: boolean
  sortOrder: number
}

export type Dock = {
  id: number
  dockCode: string
  allowedActivity: DockActivity
  currentStatus: DockStatus
}

export type TimeLog = {
  vehicleCompletedAt: string | null
  gateInAt: string | null
  dockAssignedAt: string | null
  processStartedAt: string | null
  processCompletedAt: string | null
  gateOutAt: string | null
}

export type Booking = {
  id: string
  bookingCode: string
  qrToken: string
  activityType: ActivityType
  bookingDate: string
  startTime: string
  endTime: string
  referenceDocNo: string
  licensePlate: string | null
  driverName: string | null
  driverPhone: string | null
  status: BookingStatus
  lateMinutes: number
  createdAt: string
  customer: {
    id: string
    name: string
    companyName: string | null
    phone: string | null
  }
  truckType: {
    id: number
    truckName: string
    durationMinutes: number
    blocksRequired: number
  }
  assignedDock: {
    id: number
    dockCode: string
    allowedActivity: DockActivity
  } | null
  timeLog: TimeLog | null
}

export type SlotStatus = 'AVAILABLE' | 'FULL'

export type AvailabilitySlot = {
  startMinute: number
  startLabel: string
  endMinute: number
  endLabel: string
  remaining: number
  capacity: number
  status: SlotStatus
  limitReason: string | null
}

export type Settings = {
  warehouseName: string
  operatingStartMinute: number
  operatingEndMinute: number
  operatingStartLabel: string
  operatingEndLabel: string
  slotUnitMinutes: number
  gracePeriodMinutes: number
  earlyArrivalLimitMinutes: number
  bookingWindowDays: number
  capacity: Record<ActivityType, number>
  blocksPerDay: number
  truckTypes: TruckType[]
}

export type QueueResponse = {
  date: string
  onTime: Booking[]
  late: Booking[]
  atDock: Booking[]
  upcoming: Booking[]
}

export type DockWithBooking = Dock & { currentBooking: Booking | null }

export type ScanResult = {
  booking: Booking
  canGateIn: boolean
  earlyArrival: {
    minutesTooEarly: number
    limitMinutes: number
    message: string
  } | null
  vehicleIncomplete: boolean
  projectedStatus: 'CHECKED_IN_ON_TIME' | 'LATE_WAITING_LIST'
  lateMinutes: number
  gracePeriodMinutes: number
}

export type PublicTicket = {
  bookingCode: string
  qrToken: string
  status: BookingStatus
  activityType: ActivityType
  bookingDate: string
  startTime: string
  endTime: string
  referenceDocNo: string
  licensePlate: string | null
  driverName: string | null
  customerName: string
  truckType: { truckName: string; durationMinutes: number }
  dockCode: string | null
  lateMinutes: number
  vehicleComplete: boolean
  warehouseName: string
  gracePeriodMinutes: number
  timeLog: TimeLog | null
}

export type ReportRow = {
  bookingCode: string
  bookingDate: string
  activityType: string
  customer: string
  truckType: string
  dockCode: string | null
  status: BookingStatus
  scheduledStart: string
  gateInAt: string | null
  processStartedAt: string | null
  processCompletedAt: string | null
  gateOutAt: string | null
  waitingMinutes: number | null
  processingMinutes: number | null
  turnaroundMinutes: number | null
  lateMinutes: number
}

export type ReportKpi = {
  totalBookings: number
  completed: number
  cancelled: number
  noShow: number
  onTimeRate: number
  averageWaitingMinutes: number
  averageProcessingMinutes: number
  averageTurnaroundMinutes: number
  averageLateMinutes: number
}

export type ReportDay = {
  date: string
  total: number
  completed: number
  late: number
  averageTurnaroundMinutes: number
  averageWaitingMinutes: number
}

export type ArrivalHour = {
  hour: number
  label: string
  arrivals: number
  capacity: number
}

export type DockReport = {
  dockCode: string
  activity: string
  trucks: number
  usedHours: number
  averageProcessingMinutes: number
  utilization: number
}

export type ReportResponse = {
  from: string
  to: string
  kpi: ReportKpi
  rows: ReportRow[]
  byDay: ReportDay[]
  byActivity: { activity: ActivityType; total: number }[]
  byDock: DockReport[]
  arrivalsByHour: ArrivalHour[]
}

export type ManagedUser = {
  id: string
  name: string
  email: string
  phone: string | null
  companyName: string | null
  role: Role
  isActive: boolean
  createdAt: string
}

/** Satu baris audit log, dipakai feed aktivitas dashboard. */
export type ActivityItem = {
  id: string
  action: string
  userRole: Role
  userName: string
  createdAt: string
  bookingCode: string | null
  licensePlate: string | null
  driverName: string | null
  activityType: ActivityType | null
  dockCode: string | null
  customer: string | null
  meta: unknown
}
