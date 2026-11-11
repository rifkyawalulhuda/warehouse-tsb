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

/** Kebijakan persetujuan booking di tingkat gudang. */
export type ApprovalMode = 'AUTO' | 'MANUAL'

/**
 * Sumbu persetujuan, ortogonal terhadap `BookingStatus`.
 * NOT_REQUIRED = booking tidak pernah masuk antrean (mode AUTO / whitelist / data lama).
 */
export type ApprovalStatus =
  'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  customerId: string | null
  canApproveBooking: boolean
}

export type TruckType = {
  id: number
  truckName: string
  durationMinutes: number
  blocksRequired: number
  isActive: boolean
  sortOrder: number
}

/**
 * Input membuat/mengedit jenis truk. `blocksRequired` sengaja tidak ikut:
 * server menurunkannya dari `durationMinutes`, sehingga angka yang dipakai
 * mesin kuota mustahil berbeda dari yang dikirim klien.
 */
export type TruckTypeInput = {
  truckName: string
  durationMinutes: number
  sortOrder?: number
  isActive?: boolean
}

export type Dock = {
  id: number
  dockCode: string
  allowedActivity: DockActivity
  currentStatus: DockStatus
  /// Nama area di dalam gudang; null kalau belum diisi.
  areaName: string | null
  warehouse: { id: number; name: string }
}

/**
 * Input membuat/mengedit dock. `warehouse` tidak ikut: kirim `warehouseId`
 * saja, karena yang tersimpan di baris dock hanyalah rujukannya.
 */
export type DockInput = {
  dockCode: string
  allowedActivity: DockActivity
  currentStatus?: DockStatus
  areaName?: string | null
  warehouseId?: number
}

export type Warehouse = {
  id: number
  name: string
  isActive: boolean
  /// Jumlah dock yang menunjuk ke gudang ini; tidak selalu ikut dikirim.
  _count?: { docks: number }
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
  /// Snapshot blok 30 menit yang dikunci saat booking dibuat.
  blocksLocked: number
  approvalStatus: ApprovalStatus
  approvalDeadline: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  customer: {
    id: string
    name: string
    code: string
  }
  /// Akun yang menekan tombol booking. Jejak, bukan pemilik.
  createdBy: {
    id: string
    name: string
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
  approvalMode: ApprovalMode
  approvalLeadMinutes: number
  approvalMinDecisionMinutes: number
  approvalUrgentBufferMinutes: number
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
  approvalPending: boolean
  projectedStatus: 'CHECKED_IN_ON_TIME' | 'LATE_WAITING_LIST'
  lateMinutes: number
  gracePeriodMinutes: number
}

/** Hasil pindai di layar checker: apa yang bisa dikerjakan di dock. */
export type CheckerScanResult = {
  booking: Booking
  /** Urutan tunggu (1 = paling dulu masuk gate), null bila truk tidak menunggu. */
  waitingPosition: number | null
  waitingSince: string | null
  actions: {
    assignDock: boolean
    start: boolean
    finish: boolean
  }
  docks: Array<{
    id: number
    dockCode: string
    allowedActivity: ActivityType | 'BOTH'
    currentStatus: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
    /** Kosong dan melayani aktivitas booking ini. */
    eligible: boolean
  }>
}

export type PublicTicket = {
  bookingCode: string
  qrToken: string
  status: BookingStatus
  approvalStatus: ApprovalStatus
  rejectionReason: string | null
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
  approvalStatus: ApprovalStatus
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
  expiredPending: number
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

/** Satu baris laporan milik customer. Durasi kosong bila peristiwanya belum terjadi. */
export type CustomerReportRow = {
  bookingCode: string
  bookingDate: string
  activityType: ActivityType
  truckType: string
  licensePlate: string | null
  driverName: string | null
  referenceDocNo: string
  dockCode: string | null
  status: BookingStatus
  approvalStatus: ApprovalStatus
  scheduledStart: string
  gateInAt: string | null
  processStartedAt: string | null
  processCompletedAt: string | null
  gateOutAt: string | null
  waitingMinutes: number | null
  processingMinutes: number | null
  turnaroundMinutes: number | null
  lateMinutes: number
  blocksLocked: number
  /** Blok yang customer kunci dikali menit per blok. */
  slotMinutes: number
  /** Pemakaian dock dibanding blok sendiri; di atas 100 berarti melewati blok. */
  slotUsedPercent: number | null
  slotOverrunMinutes: number | null
}

export type CustomerReportKpi = {
  totalBookings: number
  completed: number
  cancelled: number
  noShow: number
  expiredPending: number
  onTimeRate: number
  averageWaitingMinutes: number
  averageProcessingMinutes: number
  averageTurnaroundMinutes: number
  averageLateMinutes: number
  averageSlotUsedPercent: number
  overrunCount: number
}

export type CustomerReportDay = {
  date: string
  total: number
  completed: number
  late: number
  averageWaitingMinutes: number
  averageProcessingMinutes: number
  averageTurnaroundMinutes: number
  averageSlotUsedPercent: number
}

export type CustomerReportHour = {
  hour: number
  label: string
  arrivals: number
}

/**
 * Laporan customer tidak memuat kapasitas gudang: `capacity`, `utilization`,
 * dan `byDock` sengaja tidak ada di kontrak ini.
 */
export type CustomerReportResponse = {
  from: string
  to: string
  customer: { code: string; name: string }
  kpi: CustomerReportKpi
  rows: CustomerReportRow[]
  byDay: CustomerReportDay[]
  byHour: CustomerReportHour[]
  byActivity: { activity: ActivityType; total: number }[]
}

export type ManagedUser = {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  customerId: string | null
  canApproveBooking: boolean
  createdAt: string
}

/** Perusahaan customer. Pemilik bisnis booking. */
export type Customer = {
  id: string
  code: string
  name: string
  address: string | null
  city: string | null
  picName: string | null
  phone: string | null
  email: string | null
  taxId: string | null
  note: string | null
  isActive: boolean
  autoApproveBooking: boolean
  createdAt: string
  updatedAt: string
  _count?: { users: number; bookings: number }
}

/** Akun login milik satu customer. */
export type CustomerAccount = {
  id: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  canApproveBooking: boolean
  createdAt: string
}

export type CustomerDetail = Customer & {
  users: CustomerAccount[]
  _count: { bookings: number }
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

/* ----------------------------- riwayat gate ---------------------------- */

/** Jenis peristiwa di riwayat gate. Satu baris = satu peristiwa. */
export type GateHistoryEvent = 'GATE_IN' | 'GATE_OUT'

export type GateHistoryRow = {
  id: string
  event: GateHistoryEvent
  at: string
  bookingCode: string | null
  customer: string | null
  licensePlate: string | null
  driverName: string | null
  activityType: ActivityType | null
  dockCode: string | null
  gateInAt: string | null
  gateOutAt: string | null
  /** Lama truk di dalam gudang, dalam menit; null bila belum keluar. */
  minutesInside: number | null
  officerName: string | null
  officerRole: Role | null
}

export type GateHistoryResponse = {
  rows: GateHistoryRow[]
  /** true bila jumlah baris melebihi batas dan sebagian disembunyikan. */
  truncated: boolean
  from: string
  to: string
}
