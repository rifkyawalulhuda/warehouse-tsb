import { api, getData, patchData, postData, putData } from './client'
import type {
  ActivityItem,
  ActivityType,
  AvailabilitySlot,
  Booking,
  Dock,
  DockInput,
  DockWithBooking,
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

export function saveSettings(payload: {
  warehouseName?: string
  operatingStartMinute?: number
  operatingEndMinute?: number
  slotUnitMinutes?: number
  gracePeriodMinutes?: number
  earlyArrivalLimitMinutes?: number
  bookingWindowDays?: number
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

export function updateWarehouse(id: number, payload: Partial<Pick<Warehouse, 'name' | 'isActive'>>) {
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

export function scanQr(qrToken: string) {
  return getData<ScanResult>(`/ops/scan/${qrToken}`)
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

/* ------------------------------ reports ------------------------------ */

export function fetchKpi(from: string, to: string) {
  return getData<ReportResponse>('/reports/kpi', { params: { from, to } })
}

export function reportExportUrl(from: string, to: string) {
  return `${api.defaults.baseURL}/reports/export.xlsx?from=${from}&to=${to}`
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
  companyName?: string
}) {
  return postData<ManagedUser>('/users', payload)
}

export function updateUser(
  id: string,
  payload: Partial<
    Pick<ManagedUser, 'name' | 'phone' | 'companyName' | 'isActive'>
  > & { password?: string }
) {
  return patchData<ManagedUser>(`/users/${id}`, payload)
}
