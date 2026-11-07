export type DockStatus = 'kosong' | 'proses' | 'selesai' | 'booking'

export type Dock = {
  id: number
  name: string
  activity: 'Unloading' | 'Loading'
  status: DockStatus
  plate?: string
  driver?: string
  truck?: string
  startedAt?: string
  progress?: number
  nextSlot?: string
}

export const docks: Dock[] = [
  {
    id: 1,
    name: 'Dock 1',
    activity: 'Unloading',
    status: 'proses',
    plate: 'B 9421 KXD',
    driver: 'Slamet Riyadi',
    truck: 'Container 40ft',
    startedAt: '08:12',
    progress: 39,
  },
  {
    id: 2,
    name: 'Dock 2',
    activity: 'Unloading',
    status: 'proses',
    plate: 'B 8812 TRC',
    driver: 'Joko Prasetyo',
    truck: 'CDD Long',
    startedAt: '09:05',
    progress: 62,
  },
  { id: 3, name: 'Dock 3', activity: 'Unloading', status: 'kosong' },
  { id: 4, name: 'Dock 4', activity: 'Unloading', status: 'kosong' },
  {
    id: 5,
    name: 'Dock 5',
    activity: 'Loading',
    status: 'booking',
    plate: 'B 9021 SLM',
    driver: 'Agus Salim',
    truck: 'Wingbox',
    nextSlot: '10:00',
  },
  { id: 6, name: 'Dock 6', activity: 'Loading', status: 'kosong' },
]

export type LateTruck = {
  plate: string
  driver: string
  truck: string
  slot: string
  lateMinutes: number
  customer: string
}

export const lateTrucks: LateTruck[] = [
  {
    plate: 'B 9911 KDR',
    driver: 'Sutrisno',
    truck: 'Container 20ft',
    slot: '08:00',
    lateMinutes: 40,
    customer: 'PT Mitra Logistik',
  },
  {
    plate: 'B 7742 QWX',
    driver: 'Hendra Wijaya',
    truck: 'Fuso',
    slot: '08:30',
    lateMinutes: 18,
    customer: 'CV Sinar Jaya',
  },
  {
    plate: 'B 8123 TYU',
    driver: 'Bayu Prakoso',
    truck: 'CDE',
    slot: '09:00',
    lateMinutes: 9,
    customer: 'PT Andalan Raya',
  },
]

export type ScheduleRow = {
  time: string
  plate: string
  customer: string
  activity: 'Unloading' | 'Loading'
  truck: string
  status: 'terjadwal' | 'checked-in' | 'proses' | 'selesai' | 'terlambat'
  dock: string
  driver: string
}

export const schedule: ScheduleRow[] = [
  {
    time: '08:00 – 10:00',
    plate: 'B 9421 KXD',
    customer: 'PT Mitra Logistik',
    activity: 'Unloading',
    truck: 'Container 40ft',
    status: 'proses',
    dock: 'Dock 1',
    driver: 'Slamet Riyadi',
  },
  {
    time: '08:00 – 09:00',
    plate: 'B 9911 KDR',
    customer: 'PT Mitra Logistik',
    activity: 'Unloading',
    truck: 'Container 20ft',
    status: 'terlambat',
    dock: '—',
    driver: 'Sutrisno',
  },
  {
    time: '09:00 – 10:00',
    plate: 'B 8812 TRC',
    customer: 'CV Sinar Jaya',
    activity: 'Unloading',
    truck: 'CDD Long',
    status: 'proses',
    dock: 'Dock 2',
    driver: 'Joko Prasetyo',
  },
  {
    time: '09:00 – 10:30',
    plate: 'B 9021 SLM',
    customer: 'PT Sankyu Indonesia',
    activity: 'Loading',
    truck: 'Wingbox',
    status: 'checked-in',
    dock: 'Dock 5',
    driver: 'Agus Salim',
  },
  {
    time: '10:00 – 12:00',
    plate: 'B 9333 ABC',
    customer: 'PT Global Niaga',
    activity: 'Unloading',
    truck: 'Container 40ft',
    status: 'terjadwal',
    dock: '—',
    driver: 'Rudi Hartono',
  },
  {
    time: '10:30 – 11:00',
    plate: 'B 8451 DEF',
    customer: 'CV Karya Abadi',
    activity: 'Loading',
    truck: 'CDE',
    status: 'terjadwal',
    dock: '—',
    driver: 'Yanto Saputra',
  },
  {
    time: '11:00 – 12:00',
    plate: 'B 7788 GHI',
    customer: 'PT Andalan Raya',
    activity: 'Unloading',
    truck: 'Fuso',
    status: 'selesai',
    dock: 'Dock 3',
    driver: 'Bayu Prakoso',
  },
]

export const activity = [
  {
    kind: 'checkin' as const,
    title: 'B 8812 TRC check-in on-time',
    detail: 'Dock 2 · CV Sinar Jaya · tiba 08:58',
    time: '2 mnt lalu',
  },
  {
    kind: 'assign' as const,
    title: 'Admin assign Dock 2',
    detail: 'B 8812 TRC · CDD Long · mulai 09:05',
    time: '8 mnt lalu',
  },
  {
    kind: 'late' as const,
    title: 'B 9911 KDR masuk antrean terlambat',
    detail: 'Tiba 08:40 · toleransi 08:15 · +25 mnt',
    time: '21 mnt lalu',
  },
  {
    kind: 'done' as const,
    title: 'B 7788 GHI selesai bongkar',
    detail: 'Dock 3 · 01:48 · surat jalan ditandatangani',
    time: '34 mnt lalu',
  },
  {
    kind: 'walkin' as const,
    title: 'Walk-in ditambahkan',
    detail: 'B 8890 JKL · PT Mitra Logistik · override admin',
    time: '48 mnt lalu',
  },
]

export const arrivalByHour = [
  { hour: '08', datang: 6, kapasitas: 6 },
  { hour: '09', datang: 5, kapasitas: 6 },
  { hour: '10', datang: 6, kapasitas: 6 },
  { hour: '11', datang: 4, kapasitas: 6 },
  { hour: '12', datang: 2, kapasitas: 4 },
  { hour: '13', datang: 5, kapasitas: 6 },
  { hour: '14', datang: 6, kapasitas: 6 },
  { hour: '15', datang: 4, kapasitas: 6 },
  { hour: '16', datang: 3, kapasitas: 6 },
]

export const turnaroundTrend = [
  { day: 'Rab', aktual: 148, target: 150 },
  { day: 'Kam', aktual: 142, target: 150 },
  { day: 'Jum', aktual: 155, target: 150 },
  { day: 'Sab', aktual: 138, target: 150 },
  { day: 'Sen', aktual: 146, target: 150 },
  { day: 'Sel', aktual: 134, target: 150 },
]

export const kpi = [
  {
    label: 'Truk hari ini',
    value: '42',
    unit: '/ 56 slot',
    delta: '+6 vs kemarin',
    trend: 'up' as const,
    hint: 'Okupansi 75% dari kapasitas',
    icon: 'truck' as const,
  },
  {
    label: 'On-time arrival',
    value: '86',
    unit: '%',
    delta: '+3,2% vs kemarin',
    trend: 'up' as const,
    hint: '36 dari 42 truk tepat waktu',
    icon: 'clock' as const,
  },
  {
    label: 'Utilisasi dock',
    value: '74',
    unit: '%',
    delta: 'target 80%',
    trend: 'flat' as const,
    hint: '6 dock aktif · 4,4 jam terpakai',
    icon: 'gauge' as const,
  },
  {
    label: 'Rata-rata turnaround',
    value: '02:14',
    unit: '',
    delta: '−12 mnt vs kemarin',
    trend: 'down' as const,
    hint: 'Gate-in → gate-out',
    icon: 'timer' as const,
  },
]
