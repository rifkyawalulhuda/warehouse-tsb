# Rencana Implementasi: Approval Booking Dinamis

Dokumen kerja untuk fitur **persetujuan booking (approval) yang dapat diubah Admin antara
otomatis dan manual**, hasil sesi grilling. Dokumen ini **tidak mengubah kode**; ia mengunci
keputusan, bentuk data, kontrak API, aturan, dan urutan pengerjaan.

Sumber konflik yang harus dibaca lebih dulu: `docs/prd/aturan_bisnis_logika_sistem.md:31`
menyatakan booking **selalu auto-approved**. Fitur ini menjadikan auto-approve sebagai salah satu
mode, bukan satu-satunya perilaku. Karena itu bagian "Koreksi terhadap PRD" di bawah wajib
disetujui sebelum Fase 1 dijalankan.

---

## 1. Keputusan yang dikunci

| # | Topik | Keputusan |
| :--- | :--- | :--- |
| 1 | Bentuk "dinamis" | **Toggle global + whitelist per customer.** Bukan workflow engine, bukan rule engine berprioritas |
| 2 | Kuota saat PENDING | Digenggam sejak submit sampai **tenggat keputusan**; satu jalur rilis saja |
| 3 | Representasi status | Field **ortogonal** `approvalStatus`; `BookingStatus` tidak bertambah nilai |
| 4 | Hak approve | Semua role `ADMIN` otomatis; flag `canApproveBooking` menambah hak ke non-ADMIN |
| 5 | Tenggat lewat | **Auto-cancel** (`status = CANCELLED`, `approvalStatus = EXPIRED`) + lepas kuota |
| 6 | Cakupan manual | Per customer (whitelist `autoApproveBooking`), bukan per aktivitas/hari |
| 7 | Booking lama saat rilis | Grandfathered: `approvalStatus = NOT_REQUIRED`, tidak masuk antrean |
| 8 | QR Code | Nonaktif sampai `approvalStatus = APPROVED` **dan** data kendaraan lengkap |
| 9 | Laporan | Bucket KPI baru `expiredPending`, dihitung dari `approvalStatus`, bukan `status` |
| 10 | Audit | Wajib: perubahan mode, keputusan approve/reject, expire, perubahan flag user |
| 11 | Notifikasi fase 1 | Realtime in-app + tombol salin pesan `wa.me`. Email ditunda ke fase 2 |
| 12 | Batch approve | Parsial, dengan laporan per item |
| 13 | Antrean | Booking PENDING tampil di Antrean Hari Ini dengan badge, terkunci |
| 14 | Reject | Per booking + alasan wajib; masuk Riwayat; customer boleh booking ulang |
| 15 | Approve final | Tidak bisa dibatalkan |
| 16 | Definisi selesai fase 1 | Test API lengkap mengikuti pola `server/test/*.test.ts` |

### Keputusan yang saling menimpa (dicatat agar tidak diulang)

- **2.4 "multi-aturan berprioritas" dibatalkan oleh 3.1** (global + whitelist saja). Tidak ada
  tabel aturan, tidak ada UI builder aturan.
- **2.5 "auto dulu (grandfathered)" untuk flag customer dibatalkan oleh 5.1.** Yang grandfathered
  adalah **booking lama** (`approvalStatus = NOT_REQUIRED`), bukan flag customer. Flag customer
  default `false` karena mode global rilis sebagai `AUTO`.
- **4.1 "booking mendesak bypass approval" dibatalkan oleh 5.2.** Tidak ada bypass. Booking
  mendesak tetap PENDING dengan tenggat pendek.
- **Koreksi matematis 6.1.** Label pilihan berbunyi `min(startTime−30m, createdAt+15m)`, tetapi
  deskripsinya menuntut *"tidak pernah lebih awal dari createdAt+15m"*, yang berarti **MAX**.
  Dokumen ini memakai **MAX**. Memakai MIN akan menghasilkan tenggat yang sudah lewat saat booking
  dibuat.

---

## 2. Koreksi terhadap PRD

Ditambahkan ke daftar koreksi di `docs/rencana-implementasi.md` §1:

1. **Auto-Approved bukan lagi satu-satunya perilaku.**
   `aturan_bisnis_logika_sistem.md:31` dan `product_requirements_document.md:35` menyatakan setiap
   booking langsung disetujui. Setelah fitur ini, perilaku itu menjadi nilai `approvalMode = AUTO`.
   Saat `MANUAL`, customer non-whitelist masuk antrean persetujuan.
2. **QR Code punya dua syarat, bukan satu.**
   `bookings/routes.ts:209` menentukan status hanya dari kelengkapan data kendaraan. Setelah fitur
   ini, QR aktif bila `vehicleComplete AND approvalStatus = APPROVED`.
3. **`NO_SHOW` bukan satu-satunya akhir untuk booking yang tidak pernah gate-in.**
   Booking yang tidak diputuskan Admin berakhir `EXPIRED` (bukan `NO_SHOW`), karena penyebabnya
   bukan kelalaian customer.

---

## 3. Model data

### 3.1 Enum baru

```prisma
enum ApprovalMode {
  AUTO    // perilaku hari ini: semua booking langsung sah
  MANUAL  // hanya customer whitelist yang otomatis; sisanya antre
}

enum ApprovalStatus {
  NOT_REQUIRED // tidak pernah masuk antrean (auto mode / whitelist / data lama)
  PENDING      // menunggu keputusan Admin
  APPROVED     // disetujui Admin
  REJECTED     // ditolak Admin, alasan wajib
  EXPIRED      // tenggat lewat tanpa keputusan
}
```

### 3.2 `warehouse_settings`

| Kolom | Tipe | Default | Catatan |
| :--- | :--- | :--- | :--- |
| `approval_mode` | `ApprovalMode` | `AUTO` | Rilis sebagai `AUTO` supaya perilaku tidak berubah |
| `approval_lead_minutes` | `Int` | `30` | Keputusan harus selesai ≥ N menit sebelum `start_time` |
| `approval_min_decision_minutes` | `Int` | `15` | Jendela keputusan minimum sejak booking dibuat |
| `approval_urgent_buffer_minutes` | `Int` | `1440` | Ambang label **MENDESAK** di antrean |

### 3.3 `users`

| Kolom | Tipe | Default | Catatan |
| :--- | :--- | :--- | :--- |
| `auto_approve_booking` | `Boolean` | `false` | Whitelist customer; hanya bermakna saat mode `MANUAL` |
| `can_approve_booking` | `Boolean` | `false` | Memberi hak approve ke non-ADMIN. ADMIN tidak butuh flag |

### 3.4 `bookings`

| Kolom | Tipe | Catatan |
| :--- | :--- | :--- |
| `approval_status` | `ApprovalStatus` | Default `NOT_REQUIRED` |
| `approval_deadline` | `DateTime?` | Null bila `NOT_REQUIRED` |
| `approved_by_id` | `String?` (`Uuid`) | FK ke `users`, `onDelete: SetNull` |
| `approved_at` | `DateTime?` | |
| `rejection_reason` | `String?` (`VarChar(240)`) | Wajib bila `REJECTED` |
| `quota_released_at` | `DateTime?` | **Guard rilis kuota tepat sekali** |

Relasi baru: `approvedBy User? @relation("BookingApprovals", fields: [approvedById], references: [id])`
dan sisi balik di `User`.

Indeks tambahan: `@@index([approvalStatus, approvalDeadline])` untuk job expire, dan
`@@index([approvalStatus, bookingDate])` untuk antrean.

### 3.5 Migrasi

Satu migrasi `add_booking_approval`:

1. `CREATE TYPE "ApprovalMode"`, `CREATE TYPE "ApprovalStatus"`.
2. `ALTER TABLE` untuk kolom di atas dengan default.
3. **Backfill**: semua booking yang sudah ada → `approval_status = 'NOT_REQUIRED'`,
   `approval_deadline = NULL`. Tidak ada booking lama yang masuk antrean.
4. Semua `users` lama → `auto_approve_booking = false`, `can_approve_booking = false`. Sah karena
   mode global masih `AUTO`, sehingga perilaku tidak berubah.

Tidak ada backfill `approval_status = APPROVED` untuk data lama, karena `NOT_REQUIRED` lebih jujur
secara historis: booking itu tidak pernah melalui approval.

---

## 4. Aturan bisnis

### 4.1 Saat booking dibuat (`POST /api/bookings`)

```
butuhApproval =
  settings.approvalMode === 'MANUAL'
  AND user.role === 'CUSTOMER'
  AND NOT user.autoApproveBooking
```

- `butuhApproval = false` → `approvalStatus = NOT_REQUIRED`, kuota digenggam seperti sekarang.
- `butuhApproval = true` → `approvalStatus = PENDING`, kuota **tetap digenggam** (satu jalur rilis),
  dan:

```
approvalDeadline = max(
  startTime - approvalLeadMinutes,        // default 30 menit
  createdAt + approvalMinDecisionMinutes  // default 15 menit
)
```

Konsekuensi yang harus diterima: booking yang dibuat 5 menit sebelum `startTime` mendapat tenggat
`createdAt + 15 menit`, yaitu **10 menit setelah jadwal**. Itu disengaja — Admin selalu punya
jendela keputusan minimum. Booking tersebut akan `EXPIRED` dan melepas kuota setelahnya.

### 4.2 Label MENDESAK

`startTime − now ≤ approvalUrgentBufferMinutes` (default 24 jam) → badge **MENDESAK** di antrean.

> **Cacat yang diakui:** setelah bypass ditutup (keputusan 5.2), buffer 24 jam **tidak mengubah
> perilaku apa pun** — ia hanya memengaruhi badge dan prioritas tampil. Parameter ini disimpan
> sebagai konfigurasi karena sudah dipilih, tetapi jangan diberi bobot keputusan tanpa mengubah
> rencana ini lebih dulu.

### 4.3 Satu jalur rilis kuota

Tambahkan satu fungsi di `server/src/modules/bookings/quota-service.ts`:

```ts
export async function finalizeRelease(
  tx: Tx,
  params: { bookingId: string; date: DateISO; activity: ActivityType;
            startMinute: number; blocksRequired: number; window: OperatingWindow }
): Promise<boolean>
```

Perilaku:

1. `UPDATE bookings SET quota_released_at = now() WHERE id = $1 AND quota_released_at IS NULL
   RETURNING id`. Jika 0 baris → kembalikan `false`, **jangan** sentuh `slot_allocations`.
2. Bila 1 baris → jalankan `releaseBlocks(...)` yang sudah ada.
3. Kembalikan `true`.

Semua jalur yang melepas kuota **wajib** lewat fungsi ini:

- `POST /api/bookings/:id/cancel` (`bookings/routes.ts:432`)
- `POST /api/ops/no-show` (`ops/routes.ts:527`)
- job `markNoShowBookings` (`jobs/no-show.ts:46`)
- **baru:** reject (`approvals`)
- **baru:** expire (`jobs/approval-expiry.ts`)

`releaseBlocks` tetap ada sebagai primitif SQL, tetapi tidak boleh dipanggil langsung lagi.
Pemanggil lama direfaktor ke `finalizeRelease`.

### 4.4 Job expire

File baru `server/src/jobs/approval-expiry.ts`, mengikuti pola `jobs/no-show.ts`:

- Interval **5 menit**, `timer.unref()`.
- Ambil `approvalStatus = PENDING AND approvalDeadline <= now()`, `take: 200`.
- Per booking, dalam satu transaksi:
  1. `finalizeRelease(...)` — bila `false`, lewati (sudah dilepas/diputuskan).
  2. `UPDATE ... WHERE id = ? AND approval_status = 'PENDING'` → `status = 'CANCELLED'`,
     `approvalStatus = 'EXPIRED'`.
  3. `writeAudit({ action: 'BOOKING_APPROVAL_EXPIRED', userRole: 'ADMIN' })`.
  4. `emitBookingUpdated(...)`.
- Didaftarkan di `server/src/server.ts` bersama `startNoShowJob()`.

### 4.5 Job NO_SHOW harus menghormati approval

`jobs/no-show.ts:33` sekarang menyapu semua `BOOKED_INCOMPLETE`/`BOOKED_READY`. Ubah filter:

```ts
where: {
  status: { in: ['BOOKED_INCOMPLETE', 'BOOKED_READY'] },
  approvalStatus: { not: 'PENDING' },   // wilayah job expire
  bookingDate: { lte: dateOnlyToUtc(todayISO()) },
}
```

Tanpa ini, booking PENDING dicap `NO_SHOW` dan bucket KPI `expiredPending` tidak akan pernah terisi.

### 4.6 Approve / Reject (compare-and-set)

`POST /api/approvals/:id/approve`:

```
UPDATE bookings
   SET approval_status = 'APPROVED', approved_by_id = $user, approved_at = now()
 WHERE id = $1 AND approval_status = 'PENDING'
RETURNING id
```

- 0 baris → `409 APPROVAL_ALREADY_DECIDED` (`"Booking ini sudah diputuskan atau kedaluwarsa"`).
- 1 baris → audit `BOOKING_APPROVED`, `emitBookingUpdated`, enqueue notifikasi (fase 2).

`POST /api/approvals/:id/reject`:

- Body `{ reason }`, `z.string().trim().min(5).max(240)` — wajib.
- Compare-and-set yang sama, lalu dalam transaksi: `finalizeRelease(...)`,
  `status = 'CANCELLED'`, `approvalStatus = 'REJECTED'`, `rejectionReason = reason`.
- Audit `BOOKING_REJECTED` dengan `meta.reason`.

Approve **tidak** bisa dibatalkan (keputusan 4.6). Tidak ada endpoint `unapprove`.

### 4.7 Batch approve

`POST /api/approvals/batch-approve` — body `{ ids: string[] }`, maksimum 50.

- Setiap id diproses **independen** dengan compare-and-set yang sama, **bukan** satu transaksi besar.
- Respons:

```json
{ "data": { "approved": ["id1","id2"], "skipped": [{ "id": "id3", "reason": "ALREADY_DECIDED" }] } }
```

- Satu audit `BOOKING_APPROVED` per booking, plus satu `APPROVAL_BATCH_PROCESSED` berisi ringkasan.

### 4.8 QR Code & data kendaraan

- `bookingSelect` (`bookings/repository.ts:5`) menambah `approvalStatus`, `approvalDeadline`,
  `approvedAt`, `rejectionReason`.
- `statusForVehicleData` (`repository.ts:80`) **tidak diubah** — ia mengurus `BookingStatus` saja.
- Aturan tampil QR di frontend: `vehicleComplete && approvalStatus === 'APPROVED'` (atau
  `NOT_REQUIRED`).
- Supir **tetap boleh** melengkapi data kendaraan selama `approvalStatus = PENDING`
  (`public-ticket/routes.ts:82` tidak berubah). Approval dan kelengkapan data tetap independen.

### 4.9 Gate-in & scan diblokir saat PENDING

- `ops/routes.ts:73` `canGateIn` → tambah `&& booking.approvalStatus !== 'PENDING'`, dan sediakan
  `approvalPending: boolean` di respons scan agar layar Security menampilkan pesan.
- `POST /api/ops/gate-in` → sebelum transaksi, tolak:

```ts
if (booking.approvalStatus === 'PENDING') {
  throw conflict('APPROVAL_PENDING', 'Booking belum disetujui Admin. Hubungi Admin gudang.')
}
```

Dua lapis: UI dan server.

### 4.10 Antrean & tampilan operasional

- `GET /api/ops/queue` (`ops/routes.ts:568`) tetap mengembalikan booking PENDING di kelompok
  `upcoming`, dengan tambahan `approvalStatus` di tiap item.
- Booking PENDING **tidak bisa** di-assign dock: `POST /api/ops/assign-dock` menolak
  `approvalStatus = PENDING` dengan `409 APPROVAL_PENDING`.
- Frontend menampilkan badge **Menunggu persetujuan** (kuning) pada kartu.

### 4.11 Daftar booking customer

- `GET /api/bookings/my-list`: booking `REJECTED`/`EXPIRED` sudah berstatus `CANCELLED`, sehingga
  otomatis masuk `scope = 'past'` (`bookings/routes.ts:278`). Tidak perlu filter baru.
- Halaman detail booking menampilkan banner merah berisi `rejectionReason` bila `REJECTED`, dan
  banner abu-abu *"Kedaluwarsa karena tidak diputuskan Admin"* bila `EXPIRED`.
- Halaman tiket publik (`public-ticket/routes.ts:30`) menambah `approvalStatus` dan
  `rejectionReason`, ditampilkan sebagai banner yang sama.

### 4.12 Laporan

`reports/routes.ts:94` menambah:

```ts
expiredPending: rows.filter((row) => row.approvalStatus === 'EXPIRED').length
```

`ReportKpi` (`src/lib/api/types.ts:217`) dan baris ringkasan ekspor Excel
(`reports/routes.ts:301`) menambah **"Kedaluwarsa (tidak disetujui)"**.

`totalBookings` **tidak** berubah: booking PENDING dan EXPIRED sudah dihitung di dalamnya. Yang
ditambahkan hanya pemecahan penyebab.

> **Catatan utilization:** definisi utilization tidak diubah di fase 1. Booking PENDING yang
> menggenggam kuota tetap terlihat sebagai `BOOKED_READY`/`BOOKED_INCOMPLETE`, jadi angka
> utilization tidak turun. Ini konsekuensi dari memilih "genggam sampai tenggat".

### 4.13 Audit

Action baru di `audit_logs`:

| Action | Pemicu |
| :--- | :--- |
| `APPROVAL_MODE_CHANGED` | `PUT /api/settings` mengubah `approvalMode` |
| `BOOKING_APPROVED` | approve tunggal / batch |
| `BOOKING_REJECTED` | reject (meta: `reason`) |
| `BOOKING_APPROVAL_EXPIRED` | job expire |
| `APPROVAL_BATCH_PROCESSED` | ringkasan batch (meta: `approved`, `skipped`) |
| `USER_APPROVAL_FLAGS_CHANGED` | `PATCH /api/users/:id` mengubah `autoApproveBooking`/`canApproveBooking` |

`APPROVAL_MODE_CHANGED` menyimpan `meta: { from, to }`. Ini menjawab *"siapa yang mematikan
auto-approve kemarin?"*.

---

## 5. Kontrak API

### 5.1 Baru

| Method | Path | Akses | Keterangan |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/approvals` | ADMIN atau `canApproveBooking` | `?date=&status=PENDING` default `PENDING`, `take` 200, urut `approvalDeadline asc` |
| `POST` | `/api/approvals/:id/approve` | sama | Compare-and-set |
| `POST` | `/api/approvals/:id/reject` | sama | Body `{ reason }` wajib |
| `POST` | `/api/approvals/batch-approve` | sama | Body `{ ids: string[] }`, maks 50 |

Middleware baru `requireApprover` di `server/src/middleware/auth.ts`:

```ts
export async function requireApprover(req, _res, next) {
  if (!req.user) return next(unauthorized())
  if (req.user.role === 'ADMIN') return next()
  const user = await prisma.user.findUnique({
    where: { id: req.user.id }, select: { canApproveBooking: true },
  })
  if (!user?.canApproveBooking) return next(forbidden())
  next()
}
```

### 5.2 Berubah

| Method | Path | Perubahan |
| :--- | :--- | :--- |
| `GET` | `/api/settings` | + `approvalMode`, `approvalLeadMinutes`, `approvalMinDecisionMinutes`, `approvalUrgentBufferMinutes` |
| `PUT` | `/api/settings` | Skema zod + 4 field di atas; audit `APPROVAL_MODE_CHANGED` bila berubah |
| `GET` | `/api/users` | + `autoApproveBooking`, `canApproveBooking` di `select` |
| `PATCH` | `/api/users/:id` | Menerima 2 flag tersebut; audit `USER_APPROVAL_FLAGS_CHANGED` |
| `POST` | `/api/bookings` | Menghitung `approvalStatus` + `approvalDeadline` |
| `GET` | `/api/bookings/my-list`, `/:id` | Respons memuat field approval |
| `GET` | `/api/ops/scan/:qrToken` | + `approvalPending`, `canGateIn` diperketat |
| `POST` | `/api/ops/gate-in` | Tolak `APPROVAL_PENDING` |
| `POST` | `/api/ops/assign-dock` | Tolak `APPROVAL_PENDING` |
| `GET` | `/api/ops/queue` | Item memuat `approvalStatus` |
| `GET` | `/api/reports/kpi`, `export.xlsx` | + `expiredPending` |
| `GET` | `/api/tickets/:qrToken` | + `approvalStatus`, `rejectionReason` |

### 5.3 Realtime

`RealtimeEvent` (`realtime/index.ts:21`) **tidak berubah bentuk**. Cukup tambahkan
`approvalStatus` pada payload `booking.updated` supaya klien bisa membedakan.

---

## 6. Frontend

### 6.1 Halaman & komponen

| Berkas | Aksi |
| :--- | :--- |
| `src/features/approvals/index.tsx` | **Baru** — daftar PENDING, tombol Setujui/Tolak, batch checkbox, tombol salin `wa.me` |
| `src/features/approvals/reject-dialog.tsx` | **Baru** — textarea alasan wajib, min 5 karakter |
| `src/routes/_authenticated/queue.tsx` | Tambah tab **Persetujuan** (keputusan 3.10) |
| `src/features/queue/*` | Badge **Menunggu persetujuan** / **MENDESAK**; tombol assign-dock nonaktif |
| `src/features/settings/index.tsx` | Kartu baru **Kebijakan persetujuan**: select mode, 3 input angka |
| `src/features/users/*` | Dua switch di dialog ubah pengguna |
| `src/features/bookings/detail` | Banner `REJECTED` (alasan) dan `EXPIRED` |
| `src/features/ticket/*` | Banner yang sama + QR hanya bila `APPROVED` |
| `src/features/reports/*` | Kartu KPI `expiredPending` |
| `src/lib/api/endpoints.ts` | `fetchPendingApprovals`, `approveBooking`, `rejectBooking`, `batchApprove` |
| `src/lib/api/types.ts` | `ApprovalStatus`, `ApprovalMode`, field baru di `Settings`/`Booking`/`ManagedUser`/`ReportKpi` |

### 6.2 Aturan tampilan QR

```ts
const qrVisible =
  vehicleComplete &&
  (booking.approvalStatus === 'APPROVED' || booking.approvalStatus === 'NOT_REQUIRED')
```

Bila `PENDING`: tampilkan pesan *"Menunggu persetujuan Admin"* — **berbeda** dari pesan
*"Lengkapi data kendaraan"*. Dua penyebab berbeda harus punya dua pesan berbeda; kalau digabung,
supir tidak tahu apa yang harus dilakukan.

### 6.3 Template wa.me (fase 1)

Fungsi murni `buildApprovalMessage(booking)` di `src/lib/format.ts`:

- Disetujui: *"Booking {kode} tanggal {tanggal} jam {jam} telah DISETUJUI. Tunjukkan QR di gerbang."*
- Ditolak: *"Booking {kode} DITOLAK. Alasan: {reason}. Silakan buat booking baru."*

Tombol **Salin pesan WhatsApp** memakai pola `wa.me` yang sudah ada (Fase 4
`rencana-implementasi.md:260`).

---

## 7. Rencana test

Berkas baru di `server/test/`, mengikuti pola `helpers.ts` + `resetDatabase` + `loginCookie`:

### `approval.test.ts`

1. Mode `AUTO` → `approvalStatus = NOT_REQUIRED`, tidak ada deadline.
2. Mode `MANUAL` + customer non-whitelist → `PENDING`, `approvalDeadline` terisi.
3. Mode `MANUAL` + customer `autoApproveBooking = true` → `NOT_REQUIRED`.
4. `approvalDeadline = max(startTime − lead, createdAt + minWindow)` — dua kasus: booking jauh
   dan booking mendesak.
5. Customer tidak bisa approve (`403`); non-ADMIN dengan `canApproveBooking = true` bisa.
6. Approve → `APPROVED`, `approvedBy` terisi, audit `BOOKING_APPROVED`.
7. Reject tanpa alasan → `400`; dengan alasan → `REJECTED`, `status = CANCELLED`, kuota kembali,
   `rejectionReason` terisi.
8. Approve kedua kali → `409 APPROVAL_ALREADY_DECIDED`.
9. Batch campuran (1 valid, 1 sudah diputuskan) → `approved` + `skipped`, bukan gagal total.

### `approval-quota.test.ts`

10. `PENDING` menggenggam kuota: booking lain di slot yang sama melihat sisa berkurang.
11. Expire melepas kuota **tepat satu** blok-set; `slot_allocations.used` kembali ke nilai awal.
12. Expire pada booking yang sudah di-approve → tidak terjadi apa-apa.
13. **Rilis ganda**: panggil jalur cancel lalu expire pada booking yang sama → `used` hanya turun
    sekali (`quota_released_at` guard), tidak negatif.
14. `NO_SHOW` job **tidak** menyentuh `PENDING` (filter `approvalStatus`).

### `approval-concurrency.test.ts`

15. Approve dan expire bersamaan (dua koneksi Prisma, pola `concurrency.test.ts`) → tepat satu
    menang; tidak ada `approved` yang juga `EXPIRED`; kuota dilepas sesuai pemenang.
16. Dua batch approve berisi id yang sama → tidak ada rilis ganda.

### Regresi yang wajib tetap lolos

- `bookings.test.ts`, `no-show.test.ts`, `quota.test.ts`, `concurrency.test.ts`,
  `settings.test.ts`, `users.test.ts`, `master.test.ts`, `realtime.test.ts`.

---

## 8. Urutan pengerjaan

Setiap fase harus **lulus `npm run test:api` sebelum fase berikutnya** — mesin kuota tidak boleh
disentuh dalam keadaan setengah jadi.

### Fase A — Fondasi data (tanpa perilaku)

1. Enum + kolom di `schema.prisma` (§3).
2. Migrasi + backfill `NOT_REQUIRED` (§3.5).
3. `bookingSelect` menambah field approval.
4. Tipe frontend (`ApprovalStatus`, `ApprovalMode`, field baru).
5. `PUT/GET /api/settings` + 4 field; audit `APPROVAL_MODE_CHANGED`.
6. `PATCH /api/users/:id` + 2 flag; audit `USER_APPROVAL_FLAGS_CHANGED`.

**Verifikasi:** semua tes lama lolos; migrasi jalan pada DB berisi data seed; tidak ada perubahan
perilaku (mode masih `AUTO`).

### Fase B — Mesin keputusan & satu jalur rilis (paling berisiko)

7. `finalizeRelease` di `quota-service.ts`.
8. Refaktor 3 pemanggil lama (`cancel`, `ops/no-show`, `jobs/no-show.ts`) ke `finalizeRelease`.
9. Filter `approvalStatus: { not: 'PENDING' }` di `jobs/no-show.ts`.
10. `POST /api/bookings` menghitung `approvalStatus` + `approvalDeadline`.
11. `jobs/approval-expiry.ts` + daftarkan di `server.ts`.
12. Test `approval-quota.test.ts` + `approval-concurrency.test.ts`.

**Verifikasi:** tes regresi kuota lama **lolos tanpa diubah**; rilis tepat sekali terbukti di tes.

### Fase C — Endpoint approval

13. `requireApprover` middleware.
14. `GET /api/approvals`, approve, reject, batch-approve.
15. `app.ts` mendaftarkan `approvalsRouter`.
16. Test `approval.test.ts`.

### Fase D — Operasional & tampilan

17. Gate-in/scan/assign-dock memblokir PENDING.
18. Antrean memuat `approvalStatus`; badge.
19. Banner `REJECTED`/`EXPIRED` di detail booking dan tiket publik.
20. Aturan QR dua syarat.
21. Halaman `src/features/approvals/**` + tab Persetujuan.
22. Kartu Pengaturan + switch di Pengguna.
23. KPI `expiredPending` + ekspor Excel.

**Verifikasi:** `npm run build`, `npm run build:api`, `npm run lint`, `npm run test:api`,
`npm test` semuanya lolos.

### Fase E — Ditunda (fase 2)

24. Email transaksional via Resend/Maileroo **setelah domain terverifikasi (SPF/DKIM)**.
25. Tabel `email_outbox` + job retry.

Keputusan 3.7 (belum ada domain) dan 3.9 (fase 1 inti dulu) menempatkan email di luar lingkup.
Free tier tanpa domain terverifikasi hanya bisa mengirim ke alamat pemilik akun, sehingga email
akan tampak "ada" tetapi tidak berfungsi.

---

## 9. Risiko & mitigasi

| Risiko | Mitigasi |
| :--- | :--- |
| Kuota bocor karena rilis ganda | `quota_released_at` + `finalizeRelease` satu pintu; tes #13, #16 |
| Job expire dan NO_SHOW berebut | Filter `approvalStatus` saling eksklusif; tes #14 |
| Admin approve tepat saat expire | Compare-and-set `WHERE approval_status = 'PENDING'`; tes #15 |
| Fitur mati saat rilis karena semua ter-whitelist | Mode rilis `AUTO`, flag customer default `false` (§3.5) |
| Customer kabur dari approval dengan booking mendesak | Bypass dihapus; tenggat pendek + label MENDESAK |
| Approval jadi formalitas | Gate-in, scan, dan assign-dock semuanya memblokir PENDING |
| Admin tunggal tidak aktif | Semua `ADMIN` otomatis berhak approve; flag hanya menambah ke non-ADMIN |
| Approve salah tanpa jalan koreksi | Approve final; koreksi = batalkan booking lalu booking ulang (teraudit) |
| Utilization turun palsu | Diakui sebagai konsekuensi "genggam sampai tenggat" (§4.12) |
| Parameter buffer 24 jam tidak berfungsi | Diakui eksplisit di §4.2; hanya badge |

---

## 10. Pertanyaan terbuka (harus diputuskan sebelum Fase C)

1. **`approvalLeadMinutes` vs `startTime` untuk booking lintas hari.** Booking jam 08:00 besok
   dengan lead 30 menit → tenggat hari ini 23:59? Belum diputuskan apakah tenggat boleh jatuh di
   luar jam operasional. Default sementara: boleh, karena Admin bisa membuka aplikasi kapan saja.
2. **Booking PENDING yang dibatalkan customer.** Cancel tetap diizinkan (status masih
   `BOOKED_INCOMPLETE`/`BOOKED_READY`). Tetapi `approvalStatus` akan menjadi `REJECTED`? Usulan:
   `CANCELLED` + `approvalStatus` dibiarkan `PENDING` sampai reconcile — belum final.
3. **Perubahan mode `MANUAL` → `AUTO`.** Booking yang sedang `PENDING` saat mode dimatikan:
   auto-approve semuanya, atau biarkan menunggu? Usulan: biarkan, karena keputusan mode hanya
   berlaku untuk booking baru (keputusan 3.3: aturan dievaluasi sekali saat booking dibuat).
4. **Ekspor `expiredPending`** — perlu kolom baru di Excel atau cukup baris ringkasan? Usulan:
   baris ringkasan saja di fase 1.

### Keputusan yang diambil saat eksekusi

Pertanyaan 1 & 4 dijawab saat implementasi dan **sudah diterapkan**:

1. **Tenggat boleh jatuh di luar jam operasional.** Tidak ada klausa tambahan di
   `computeApprovalDeadline`; Admin bisa membuka aplikasi kapan saja. Menambah batas jam
   operasional akan membuat booking malam hari tidak punya jendela keputusan.
4. **Ekspor Excel memakai baris ringkasan saja** (`Kedaluwarsa (tidak disetujui)`), tanpa kolom
   baru di sheet Detail Booking. Kolom `approvalStatus` tetap ada di data baris, hanya tidak
   dicetak.

Pertanyaan 2 & 3 dijawab **implisit oleh perilaku yang diuji**:

2. Booking yang dibatalkan customer menyisakan `approvalStatus = 'PENDING'` dengan
   `status = 'CANCELLED'`. Job expire **menyaring `status IN ('BOOKED_INCOMPLETE','BOOKED_READY')`**
   sehingga booking itu tidak pernah disentuh lagi: tidak ada rilis kuota kedua dan tidak ada audit
   `EXPIRED` yang menyesatkan. Ini lebih murah daripada reconcile terjadwal, dan tidak menimbulkan
   kerusakan karena `quota_released_at` sudah terisi oleh jalur cancel.
3. Booking PENDING **tidak** diubah saat mode dimatikan. Keputusan hanya dievaluasi saat booking
   dibuat (keputusan 3.3), jadi booking yang sudah antre tetap menunggu sampai diputuskan atau
   kedaluwarsa.

---

## 11. Status eksekusi

Semua fase A–D selesai dan terverifikasi. Fase E (email) tetap ditunda sesuai keputusan 3.7 dan
3.9.

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npx tsc -p server/tsconfig.json --noEmit` | lolos |
| `npx tsc -p tsconfig.app.json --noEmit` | lolos |
| `npx vite build` | lolos (hanya peringatan ukuran chunk yang sudah ada sebelumnya) |
| `npx eslint .` | 0 error (4 warning bawaan template, sama seperti baseline) |
| `npm run test:api` | **97 tes lolos** (12 berkas) — naik dari 67 |
| `npm test` (Vitest browser) | 64 tes lolos (10 berkas) |
| Migrasi pada DB berisi data | 11 booking lama ter-backfill `NOT_REQUIRED`; tidak ada yang masuk antrean |
| Rilis kuota tepat sekali | `finalizeRelease` + guard `quota_released_at`; diuji pada cancel→expire dan pemanggilan ganda |
| Race approve vs expire | `approval-concurrency.test.ts` (3 kasus, dua koneksi Prisma nyata) |

### Berkas baru

| Berkas | Isi |
| :--- | :--- |
| `server/prisma/migrations/20261109090000_add_booking_approval/migration.sql` | Enum, kolom, backfill, FK, indeks |
| `server/src/modules/approvals/routes.ts` | Daftar, approve, reject, batch |
| `server/src/jobs/approval-expiry.ts` | Job expire 5 menit |
| `server/test/approval.test.ts` | 19 tes aturan & endpoint |
| `server/test/approval-quota.test.ts` | 8 tes kuota, KPI, gate-in |
| `server/test/approval-concurrency.test.ts` | 3 tes race |
| `src/features/approvals/index.tsx` | Panel antrean + dialog tolak |
| `src/components/approval-badge.tsx` | Badge sumbu approval |
| `src/lib/approval-message.ts` | Template pesan `wa.me` |

### Berkas yang diubah

`server/prisma/schema.prisma`, `server/src/modules/bookings/{repository,routes,quota-service}.ts`,
`server/src/jobs/no-show.ts`, `server/src/modules/{settings,users,auth,ops,reports,public-ticket}/routes.ts`,
`server/src/middleware/auth.ts`, `server/src/app.ts`, `server/src/server.ts`,
`src/lib/api/{types,endpoints}.ts`, `src/features/{queue,ticket,settings,users,scanner,reports}/*`,
`src/features/bookings/detail.tsx`, `src/stores/auth-store.test.ts`.
