import {
  api,
  deleteData,
  getData,
  patchData,
  postData,
  putData,
} from './client'
import type {
  ActivityItem,
  ActivityType,
  ApprovalMode,
  ApprovalStatus,
  AvailabilitySlot,
  Booking,
  CheckerScanResult,
  Customer,
  CustomerDetail,
  CustomerAccount,
  CustomerReportResponse,
  Dock,
  DockInput,
  DockWithBooking,
  GateHistoryResponse,
  ManagedUser,
  PublicTicket,
  QueueResponse,
  ReportResponse,
  ScanResult,
  SessionUser,
  Settings,
  TruckType,
  TruckTypeInput,
  Warehouse,
} from './types'

/* -------------------------------- auth ------------------------------- */

export function login(email: string, password: string) {
  return postData<SessionUser>('/auth/login', { email, password })
}

export function logout() {
  return postData<{ ok: boolean }>('/auth/logout')
}

export function fetchMe() {
  return getData<SessionUser>('/auth/me')
}

/* ------------------------------ settings ----------------------------- */

export function fetchSettings() {
  return getData<Settings>('/settings')
}

/** Judul aplikasi untuk halaman sebelum masuk; tidak butuh sesi. */
export type Branding = Pick<Settings, 'appName' | 'appTagline' | 'appShortName'>

export async function fetchBranding(): Promise<Branding | null> {
  // Server mengirim `null` bila pengaturan belum pernah dibuat.
  return getData<Branding | null>('/branding')
}

export function saveSettings(payload: {
  warehouseName?: string
  appName?: string
  appTagline?: string
  appShortName?: string | null
  operatingStartMinute?: number
  operatingEndMinute?: number
  slotUnitMinutes?: number
  gracePeriodMinutes?: number
  earlyArrivalLimitMinutes?: number
  bookingWindowDays?: number
  approvalMode?: ApprovalMode
  approvalLeadMinutes?: number
  approvalMinDecisionMinutes?: number
  approvalUrgentBufferMinutes?: number
}) {
  return putData<Settings>('/settings', payload)
}

/* ------------------------------- master ------------------------------ */

export function fetchDocks() {
  return getData<{ docks: Dock[]; capacities: Record<ActivityType, number> }>(
    '/master/docks'
  )
}

export function createDock(payload: DockInput) {
  return postData<Dock>('/master/docks', payload)
}

export function updateDock(id: number, payload: Partial<DockInput>) {
  return patchData<Dock>(`/master/docks/${id}`, payload)
}

export function fetchWarehouses() {
  return getData<Warehouse[]>('/master/warehouses')
}

export function createWarehouse(payload: { name: string }) {
  return postData<Warehouse>('/master/warehouses', payload)
}

export function updateWarehouse(
  id: number,
  payload: Partial<Pick<Warehouse, 'name' | 'isActive'>>
) {
  return patchData<Warehouse>(`/master/warehouses/${id}`, payload)
}

export function fetchTruckTypes() {
  return getData<TruckType[]>('/master/truck-types')
}

export function createTruckType(payload: TruckTypeInput) {
  return postData<TruckType>('/master/truck-types', payload)
}

export function updateTruckType(id: number, payload: Partial<TruckTypeInput>) {
  return patchData<TruckType>(`/master/truck-types/${id}`, payload)
}

/* ------------------------------- slots ------------------------------- */

export type AvailabilityResponse = {
  date: string
  activity: ActivityType
  capacity: number
  truckType: TruckType
  slots: AvailabilitySlot[]
}

export function fetchAvailability(params: {
  date: string
  activity: ActivityType
  truckTypeId: number
}) {
  return getData<AvailabilityResponse>('/bookings/slots/availability', {
    params,
  })
}

/* ------------------------------ bookings ----------------------------- */

export type CreateBookingPayload = {
  bookingDate: string
  activityType: ActivityType
  truckTypeId: number
  startMinute: number
  referenceDocNo: string
  licensePlate?: string
  driverName?: string
  driverPhone?: string
}

export function createBooking(payload: CreateBookingPayload) {
  return postData<Booking>('/bookings', payload)
}

export function fetchMyBookings(scope: 'active' | 'past' | 'all' = 'active') {
  return getData<Booking[]>('/bookings/my-list', { params: { scope } })
}

export function fetchBooking(id: string) {
  return getData<Booking>(`/bookings/${id}`)
}

export function updateVehicleInfo(
  id: string,
  payload: { licensePlate?: string; driverName?: string; driverPhone?: string }
) {
  return patchData<Booking>(`/bookings/${id}/vehicle-info`, payload)
}

export function cancelBooking(id: string) {
  return postData<{ id: string; status: string }>(`/bookings/${id}/cancel`)
}

/* ----------------------------- approvals ----------------------------- */

export type ApprovalQueue = {
  status: ApprovalStatus
  total: number
  bookings: Booking[]
}

export function fetchApprovals(params?: {
  status?: ApprovalStatus
  date?: string
}) {
  return getData<ApprovalQueue>('/approvals', { params })
}

export function approveBooking(id: string) {
  return postData<Booking>(`/approvals/${id}/approve`)
}

export function rejectBooking(id: string, reason: string) {
  return postData<Booking>(`/approvals/${id}/reject`, { reason })
}

export function batchApproveBookings(ids: string[]) {
  return postData<{
    approved: string[]
    skipped: { id: string; reason: string }[]
  }>('/approvals/batch-approve', { ids })
}

/* ---------------------------- tiket publik --------------------------- */

export function fetchPublicTicket(qrToken: string) {
  return getData<PublicTicket>(`/tickets/${qrToken}`)
}

export function completeVehicleByTicket(
  qrToken: string,
  payload: { licensePlate?: string; driverName?: string; driverPhone?: string }
) {
  return patchData<{ status: string; licensePlate: string | null }>(
    `/tickets/${qrToken}/vehicle-info`,
    payload
  )
}

/* --------------------------------- ops ------------------------------- */

export function scanQr(qrToken: string, options: { record?: boolean } = {}) {
  return getData<ScanResult>(`/ops/scan/${qrToken}`, {
    params: options.record ? { record: 1 } : undefined,
  })
}

export function fetchCheckerScan(qrToken: string) {
  return getData<CheckerScanResult>(`/ops/checker/scan/${qrToken}`)
}

export function gateIn(qrToken: string) {
  return postData<Booking>('/ops/gate-in', { qrToken })
}

export function gateOut(qrToken: string) {
  return postData<Booking>('/ops/gate-out', { qrToken })
}

export function assignDock(bookingId: string, dockId: number) {
  return postData<Booking>('/ops/assign-dock', { bookingId, dockId })
}

export function unassignDock(bookingId: string) {
  return postData<Booking>('/ops/unassign-dock', { bookingId })
}

export function startProcess(bookingId: string) {
  return postData<Booking>('/ops/start-process', { bookingId })
}

export function finishProcess(bookingId: string) {
  return postData<Booking>('/ops/finish-process', { bookingId })
}

export function markNoShow(bookingId: string) {
  return postData<Booking>('/ops/no-show', { bookingId })
}

export function fetchQueue(date?: string) {
  return getData<QueueResponse>('/ops/queue', { params: { date } })
}

export function fetchOpsDocks() {
  return getData<DockWithBooking[]>('/ops/docks')
}

export function fetchDockWorklist() {
  return getData<Booking[]>('/ops/dock-worklist')
}

export function fetchActivity(limit = 12) {
  return getData<ActivityItem[]>('/ops/activity', { params: { limit } })
}

export type GateHistoryQuery = { from: string; to: string; q?: string }

export function fetchGateHistory({ from, to, q }: GateHistoryQuery) {
  return getData<GateHistoryResponse>('/ops/gate-history', {
    params: { from, to, q: q?.trim() ? q.trim() : undefined },
  })
}

/* ------------------------------ reports ------------------------------ */

export function fetchKpi(from: string, to: string, customerId?: string) {
  return getData<ReportResponse>('/reports/kpi', {
    params: { from, to, customerId },
  })
}

export function reportExportUrl(from: string, to: string, customerId?: string) {
  const params = new URLSearchParams({ from, to })
  if (customerId) params.set('customerId', customerId)
  return `${api.defaults.baseURL}/reports/export.xlsx?${params.toString()}`
}

/* -------------------------- laporan customer -------------------------- */

/**
 * Tanpa parameter customer: server memakai `customerId` dari sesi. Endpoint
 * staf (`fetchKpi`/`reportExportUrl`) tetap terpisah agar tidak ada jalur
 * query yang bisa dipakai customer untuk memilih perusahaan lain.
 */
export function fetchMyReport(from: string, to: string) {
  return getData<CustomerReportResponse>('/reports/my', {
    params: { from, to },
  })
}

export function myReportExportUrl(from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  return `${api.defaults.baseURL}/reports/my/export.xlsx?${params.toString()}`
}

/* -------------------------------- users ------------------------------ */

export function fetchUsers(params?: { role?: string; q?: string }) {
  return getData<ManagedUser[]>('/users', { params })
}

export function createUser(payload: {
  name: string
  email: string
  role: ManagedUser['role']
  password: string
  phone?: string
}) {
  return postData<ManagedUser>('/users', payload)
}

export function updateUser(
  id: string,
  payload: Partial<
    Pick<ManagedUser, 'name' | 'phone' | 'isActive' | 'canApproveBooking'>
  > & { password?: string }
) {
  return patchData<ManagedUser>(`/users/${id}`, payload)
}

/* ------------------------------ customers ---------------------------- */

export function fetchCustomers(params?: {
  q?: string
  isActive?: 'true' | 'false'
}) {
  return getData<Customer[]>('/customers', { params })
}

export function fetchCustomerOptions() {
  return getData<Pick<Customer, 'id' | 'code' | 'name'>[]>('/customers/options')
}

export function fetchCustomer(id: string) {
  return getData<CustomerDetail>(`/customers/${id}`)
}

export type CustomerProfileInput = {
  name: string
  address?: string | null
  city?: string | null
  picName?: string | null
  phone?: string | null
  email?: string | null
  taxId?: string | null
  note?: string | null
  isActive?: boolean
  autoApproveBooking?: boolean
}

export function createCustomer(payload: CustomerProfileInput) {
  return postData<Customer>('/customers', payload)
}

export function updateCustomer(
  id: string,
  payload: Partial<CustomerProfileInput>
) {
  return patchData<Customer>(`/customers/${id}`, payload)
}

export function deleteCustomer(id: string) {
  return deleteData<{ id: string; deleted: boolean }>(`/customers/${id}`)
}

export function createCustomerAccount(
  customerId: string,
  payload: { name: string; email: string; password: string; phone?: string }
) {
  return postData<CustomerAccount>(`/customers/${customerId}/users`, payload)
}

export function updateCustomerAccount(
  customerId: string,
  userId: string,
  payload: Partial<{
    name: string
    phone: string | null
    isActive: boolean
    password: string
    canApproveBooking: boolean
  }>
) {
  return patchData<CustomerAccount>(
    `/customers/${customerId}/users/${userId}`,
    payload
  )
}
