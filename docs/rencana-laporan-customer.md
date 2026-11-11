# Rencana Implementasi: Laporan Customer + Ekspor Excel

Dokumen kerja hasil sesi grilling untuk menambah **Laporan milik Customer** atas booking
perusahaannya sendiri, lengkap dengan ekspor Excel. Halaman staf di `/reports`
(ADMIN/CHECKER) **tidak diubah perilakunya**; ia hanya dipindah ke dalam layout route.

---

## 1. Keputusan yang dikunci

| # | Topik | Keputusan |
| :--- | :--- | :--- |
| 1 | Cakupan | Tabel, ekspor Excel, KPI, dan dua grafik — semuanya di iterasi ini |
| 2 | Kapasitas gudang | Kapasitas slot per jam dan utilisasi dock **tidak** tampil ke customer |
| 3 | Pengganti | "Pemakaian slot sendiri" per booking, bukan utilisasi gudang |
| 4 | Definisi pemakaian slot | `processingMinutes / (blocksLocked × slotUnitMinutes)`, dibulatkan ke persen |
| 5 | Ambang lewat blok | `slotOverrunMinutes = max(0, processingMinutes − slotMinutes)`; > 0 dihitung sebagai pelanggaran |
| 6 | Cakupan status | Semua status dalam rentang; durasi kosong bila peristiwanya belum terjadi |
| 7 | Dasar tanggal | `bookings.booking_date` (sama dengan laporan staf) |
| 8 | Rentang maksimum | 366 hari inklusif; lebih dari itu ditolak 400 |
| 9 | Grafik | Booking per hari (total, selesai, terlambat) + kedatangan truk per jam **tanpa garis kapasitas** |
| 10 | Isi Excel | Tiga sheet: `Ringkasan`, `Detail`, `per Hari` |
| 11 | Kepemilikan | `customerId` **selalu** dari sesi; parameter `customerId` tidak dibaca |
| 12 | Struktur halaman | Customer di `/reports/customer`, staf tetap di `/reports` |
| 13 | Ekspor | Mengikuti filter tanggal di layar; tidak ada filter lain |
| 14 | Identitas perusahaan | Diambil di server dari `customerId` sesi (layar dan Excel) |

---

## 2. Mengapa kapasitas gudang tidak ikut

Laporan staf menghitung:

```
kapasitas per jam = jumlah dock aktif × (60 / slotUnitMinutes)
utilisasi dock    = jam terpakai / (jam operasional × jumlah hari)
```

Keduanya memakai **penyebut milik gudang**, sedangkan pembilang laporan customer hanya
berisi booking perusahaan itu. Untuk customer dengan 2 truk dari 12 slot, hasilnya 3%:
angka yang benar secara aritmetika, salah secara arti. Ia juga membocorkan jumlah dock dan
tingkat kesibukan gudang ke pihak luar.

Karena itu laporan customer memakai penyebut milik customer sendiri: **blok yang ia booking**
(`bookings.blocks_locked`, snapshot saat booking dibuat). Snapshot dipakai, bukan
`truck_types.blocks_required`, mengikuti aturan yang sama dengan pelepasan kuota.

---

## 3. Kontrak API

| Method | Path | Akses | Keterangan |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/my?from&to` | CUSTOMER | KPI, baris, rekap harian, kedatangan per jam |
| `GET` | `/api/reports/my/export.xlsx?from&to` | CUSTOMER | Berkas `.xlsx` tiga sheet |

- Router laporan tetap satu berkas; middleware `requireExactRole` dipasang **per rute**:
  `ADMIN`/`CHECKER` untuk `/kpi` dan `/export.xlsx`, `CUSTOMER` untuk `/my*`.
  Staf yang membuka `/my` mendapat 403, customer yang membuka `/kpi` mendapat 403.
- Akun CUSTOMER tanpa `customerId` mendapat 403 `Akun tidak terhubung ke customer`.
- `customerId` dari query **tidak pernah** dibaca pada rute customer, sehingga menambahkan
  `?customerId=<perusahaan lain>` tidak mengubah apa pun.

### 3.1 Validasi

- `from`/`to` wajib `YYYY-MM-DD`.
- `from > to` → 400 `VALIDATION_ERROR`.
- `selisih hari + 1 > 366` → 400 `Rentang maksimal 366 hari`.

---

## 4. Bentuk data

```ts
type CustomerReportRow = {
  bookingCode: string
  bookingDate: string          // YYYY-MM-DD
  activityType: ActivityType
  truckType: string
  licensePlate: string | null
  driverName: string | null
  referenceDocNo: string
  dockCode: string | null
  status: BookingStatus
  approvalStatus: ApprovalStatus
  scheduledStart: string       // jam Jakarta, id-ID
  gateInAt: string | null
  processStartedAt: string | null
  processCompletedAt: string | null
  gateOutAt: string | null
  waitingMinutes: number | null
  processingMinutes: number | null
  turnaroundMinutes: number | null
  lateMinutes: number
  blocksLocked: number
  slotMinutes: number
  slotUsedPercent: number | null
  slotOverrunMinutes: number | null
}

type CustomerReportKpi = {
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
```

Respons lengkap: `{ customer: { code, name }, from, to, kpi, rows, byDay, byHour, byActivity }`.

- **Tidak ada** `arrivalsByHour.capacity`, **tidak ada** `byDock`, **tidak ada** `utilization`.
- `byDay`: `date,total,completed,late,averageWaitingMinutes,averageProcessingMinutes,
  averageTurnaroundMinutes,averageSlotUsedPercent`.
- `byHour`: `hour,label,arrivals`.
- `byActivity`: total `LOADING`/`UNLOADING`.

---

## 5. Aturan hitung

| Metrik | Rumus |
| :--- | :--- |
| Tunggu | `gateInAt → processStartedAt` |
| Proses | `processStartedAt → processCompletedAt` |
| Turnaround | `gateInAt → gateOutAt` |
| Terlambat | snapshot `bookings.late_minutes` (diisi saat gate-in) |
| On-time | baris dengan gate-in dan `lateMinutes = 0` ÷ baris dengan gate-in |
| Menit slot | `blocksLocked × settings.slotUnitMinutes` |
| Pemakaian slot | `round(proses / menit slot × 100)`, `null` bila proses belum ada |
| Lewat blok | `max(0, proses − menit slot)` |

Rata-rata hanya dihitung dari baris yang punya nilai; hari yang belum selesai tidak
menyeret angka ke nol. Booking aktif, batal, dan no-show tetap muncul sebagai baris dengan
durasi kosong.

---

## 6. Isi Excel

Nama berkas: `laporan-<kode-customer>-<from>-<to>.xlsx`.

| Sheet | Isi |
| :--- | :--- |
| `Ringkasan` | Nama & kode perusahaan, periode, seluruh KPI, termasuk pemakaian slot dan jumlah lewat blok |
| `Detail` | Kode, tanggal, aktivitas, jenis truk, plat, supir, no. dokumen, dock, status, persetujuan, jadwal, gate-in, mulai proses, selesai proses, gate-out, tunggu, proses, turnaround, terlambat, blok, menit slot, pemakaian slot (%), lewat blok (menit) |
| `per Hari` | Tanggal, total, selesai, terlambat, rata-rata tunggu/proses/turnaround, rata-rata pemakaian slot |

Header tebal, baris pertama dibekukan, `autoFilter` pada sheet `Detail`. Status dan aktivitas
ditulis dalam bahasa Indonesia, bukan enum mentah.

---

## 7. Halaman `/reports/customer`

- Filter: Dari, Sampai, preset Hari ini / 7 hari / 30 hari, Atur ulang, Muat ulang.
  **Tidak ada** dropdown customer — perusahaannya sudah ditentukan sesi.
- Tombol `Ekspor Excel` memakai pola yang sama dengan halaman staf: tautan baru dirender
  setelah data rentang terpilih benar-benar masuk; selama `isPlaceholderData` tombol mati.
- Kartu utama: Total booking, Tingkat on-time, Rata-rata turnaround, Pemakaian slot.
- Kartu rincian: Selesai, Dibatalkan, No-show, Kedaluwarsa, Rata-rata tunggu,
  Rata-rata proses, Lewat blok.
- Grafik: Booking per hari dan Kedatangan truk per jam (tanpa kapasitas).
- Daftar booking: tabel di desktop, kartu ringkas di layar < 768 px (customer memakai ponsel).
- Keadaan memuat, kosong, dan gagal memakai komponen `LoadingBlock`/`ErrorBlock` yang sudah ada.
- Menu customer bertambah satu item: **Laporan** (`BarChart3`) di grup Booking.

---

## 8. Berkas yang disentuh

**Server**

- `server/src/modules/reports/routes.ts` — pisah middleware per rute, `buildCustomerReport`,
  rute `/my` dan `/my/export.xlsx`, skema rentang customer.

**Frontend**

- `src/lib/api/types.ts` — tipe laporan customer.
- `src/lib/api/endpoints.ts` — `fetchMyReport`, `myReportExportUrl`.
- `src/features/reports/customer.tsx` — halaman customer.
- `src/features/reports/customer.test.tsx` — tes halaman.
- `src/routes/_authenticated/reports.tsx` → `reports/route.tsx` + `reports/index.tsx` +
  `reports/customer.tsx` — layout route dengan `Outlet`.
- `src/components/layout/data/sidebar-data.ts` + tesnya — menu customer.

---

## 9. Tes

`server/test/customer-report.test.ts`

1. Customer hanya melihat booking perusahaannya; `?customerId=<perusahaan lain>` diabaikan.
2. Rekan seperusahaan berbagi laporan yang sama.
3. Respons tidak memuat `capacity`, `utilization`, `byDock`, atau `arrivalsByHour[].capacity`.
4. Admin dan checker mendapat 403 di `/my`; customer mendapat 403 di `/kpi` dan `/export.xlsx`.
5. Rentang 367 hari ditolak 400; 366 hari diterima; `from > to` ditolak 400.
6. KPI: on-time, rata-rata tunggu/proses/turnaround, batal/no-show/kedaluwarsa.
7. Pemakaian slot memakai `blocksLocked`; mengubah `truck_types.durationMinutes` setelah
   booking tidak mengubah angka laporan.
8. Ekspor mengembalikan `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
   tiga sheet, dan hanya baris milik customer itu.
9. Akun CUSTOMER tanpa `customerId` mendapat 403.

`src/features/reports/customer.test.tsx`

1. Tidak ada kontrol pemilihan customer.
2. Rentang bawaan tujuh hari terakhir dan preset mengubah rentang.
3. Ekspor mati selama data rentang baru belum masuk.
4. KPI dan pesan kosong tampil.

---

## 10. Definisi selesai

- [ ] Kedua rute customer berjalan dan menolak peran lain.
- [ ] Isolasi data terbukti lewat tes, termasuk parameter `customerId` palsu.
- [ ] Tidak ada angka kapasitas/utilisasi gudang di JSON maupun Excel.
- [ ] Excel tiga sheet terbuka di Excel/LibreOffice tanpa peringatan.
- [ ] Halaman customer dipakai nyata di lebar 393 px dan 1440 px.
- [ ] Menu customer menampilkan Laporan; menu staf tidak berubah.
- [ ] `npm run test:api`, `npm test`, `npm run build`, `npm run lint` hijau.
