# Rencana Implementasi: Master Data Customer

Dokumen kerja untuk memisahkan **Customer (perusahaan)** dari **akun login**, hasil sesi grilling.
Dokumen ini **tidak mengubah kode**; ia mengunci keputusan, bentuk data, kontrak API, dan urutan
pengerjaan.

---

## 1. Keputusan yang dikunci

| # | Topik | Keputusan |
| :--- | :--- | :--- |
| 1 | Bentuk entitas | Tabel baru `customers` (perusahaan). Bukan tampilan baru atas `users` |
| 2 | Halaman Pengguna | Customer **dipindahkan**; tab/daftar customer dihapus dari `src/features/users` |
| 3 | Kepemilikan booking | Dua kolom: `customerId` → `customers.id` dan `createdById` → `users.id` |
| 4 | Relasi akun | Tepat satu perusahaan per akun: `users.customerId` → `customers.id` (FK tunggal) |
| 5 | Whitelist approval | Flag `autoApproveBooking` **pindah** dari `users` ke `customers` |
| 6 | Migrasi data | Gabung akun CUSTOMER per `company_name`; fallback `Customer <email>` bila kosong |
| 7 | Akun nonaktif | Tetap ditautkan ke customer |
| 8 | Nama customer | `customers.name`, **unik** (case-insensitive) |
| 9 | Hapus customer | Hanya bila tidak punya akun dan tidak punya booking |
| 10 | Akun customer | Dikelola di dalam detail customer (buat, reset password, nonaktifkan) |
| 11 | `POST /api/users` | **Menolak** role CUSTOMER; satu pintu lewat Master Data Customer |
| 12 | Realtime | Room baru `customer:<customerId>` |
| 13 | Otorisasi booking | Semua akun perusahaan boleh lihat dan batalkan booking perusahaannya |
| 14 | Laporan | Filter customer opsional + kolom customer di Excel |
| 15 | Kata sandi awal | Diisi Admin saat membuat akun |
| 16 | Rilis | Semua sekaligus, satu migrasi |
| 17 | Definisi selesai | Tes API lengkap + semua tes lama diperbaiki |

---

## 2. Mengapa ini berisiko: tiga kegagalan senyap

`Booking.customerId` saat ini `String` tanpa FK eksplisit ke `users` (relasi Prisma
`customer Customer @relation(...)`). Kalau hanya **arti** kolom itu diubah dari `users.id` menjadi
`customers.id`, TypeScript **tidak akan mengeluh** karena tipenya tetap `String`. Tiga tempat akan
salah diam-diam:

| Lokasi | Kode sekarang | Gejala bila tidak diperbaiki |
| :--- | :--- | :--- |
| `bookings/routes.ts:303` | `where: { customerId: user.id }` | "Jadwal Saya" kosong; bukan error |
| `bookings/routes.ts:363,446` | `booking.customerId === user.id` | Customer selalu 403 saat membatalkan booking-nya sendiri |
| `realtime/index.ts:114` | `io.to(rooms.user(payload.userId))` | Tiket customer berhenti update tanpa error |

**Mitigasi struktural:** kolom lama **di-rename** menjadi `createdById`. Tidak ada nama kolom yang
artinya berubah diam-diam, sehingga kompilator memaksa setiap pemakai diperiksa. Ini keputusan 2.2.

---

## 3. Model data

### 3.1 Tabel baru

```prisma
model Customer {
  id    String @id @default(uuid()) @db.Uuid
  code  String @unique @db.VarChar(24)   // CUST-001, auto
  name  String @unique @db.VarChar(160)  // nama perusahaan, unik
  address   String? @db.VarChar(240)
  city      String? @db.VarChar(80)
  picName   String? @map("pic_name") @db.VarChar(120)
  phone     String? @db.VarChar(24)
  email     String? @db.VarChar(160)     // email perusahaan, BUKAN identitas login
  taxId     String? @map("tax_id") @db.VarChar(40)  // NPWP
  note      String? @db.VarChar(240)
  isActive  Boolean @default(true) @map("is_active")
  /// Whitelist approval: saat mode MANUAL, booking perusahaan ini tidak perlu antre.
  autoApproveBooking Boolean @default(false) @map("auto_approve_booking")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(3)

  users    User[]
  bookings Booking[] @relation("CustomerBookings")

  @@map("customers")
}
```

> Nama unik tidak bisa dijamin case-insensitive oleh `@unique`. Migrasi menambahkan
> `CREATE UNIQUE INDEX ... ON customers (lower(name))` dan API memeriksa dengan `mode: 'insensitive'`.

### 3.2 `users`

| Perubahan | Detail |
| :--- | :--- |
| **Tambah** `customer_id` | `String?` → FK `customers.id`, `onDelete: Restrict`. Nullable hanya untuk non-CUSTOMER |
| **Hapus** `company_name` | Digantikan `customers.name` |
| **Hapus** `auto_approve_booking` | Pindah ke `customers` |
| **Tambah** relasi | `customer Customer? @relation(fields: [customerId], references: [id])` |

`canApproveBooking` **tetap** di `users` — itu hak per-akun, bukan atribut perusahaan.

### 3.3 `bookings`

| Perubahan | Detail |
| :--- | :--- |
| **Rename** `customer_id` → `created_by_id` | FK `users.id`, wajib. Arti: akun yang membuat |
| **Tambah** `customer_id` | FK `customers.id`, wajib. Arti: pemilik bisnis |
| Relasi | `customer Customer @relation("CustomerBookings", ...)`, `createdBy User @relation("BookingCreator", ...)` |

`@@index([customerId, bookingDate])` dipertahankan; tambah `@@index([createdById])`.

### 3.4 Migrasi `add_customer_master`

Urutan yang harus tepat:

1. `CREATE TABLE customers`, unique index `lower(name)`.
2. **Backfill customer dari `users`:**
   ```sql
   -- Kelompokkan akun CUSTOMER per company_name (trim, case-insensitive).
   INSERT INTO customers (id, code, name, auto_approve_booking, is_active)
   SELECT gen_random_uuid(),
          'CUST-' || lpad((row_number() OVER (ORDER BY lower(btrim(company_name))))::text, 3, '0'),
          min(btrim(company_name)),
          bool_or(auto_approve_booking),
          true
   FROM users
   WHERE role = 'CUSTOMER' AND company_name IS NOT NULL AND btrim(company_name) <> ''
   GROUP BY lower(btrim(company_name));
   ```
3. **Fallback untuk akun tanpa `company_name`:** satu customer per akun, nama `'Customer ' || email`.
4. `ALTER TABLE users ADD COLUMN customer_id UUID`.
5. Tautkan: `UPDATE users u SET customer_id = c.id FROM customers c WHERE u.role='CUSTOMER' AND lower(btrim(u.company_name)) = lower(c.name)` — plus jalur fallback per email.
6. `ALTER TABLE bookings RENAME COLUMN customer_id TO created_by_id`.
   - FK lama (`bookings_customer_id_fkey` → `users.id`) **tetap valid** karena arti barunya memang
     menunjuk `users.id`; cukup di-rename agar namanya tidak menyesatkan.
   - Indeks `bookings_customer_id_booking_date_idx` ikut berpindah ke `created_by_id` dan harus
     di-rename manual (`ALTER INDEX ... RENAME TO`), lalu dibuat indeks baru untuk `customer_id`.
7. `ALTER TABLE bookings ADD COLUMN customer_id UUID`.
8. Isi `bookings.customer_id` dari `created_by_id` → `users.customer_id`.
9. `SET NOT NULL` pada `bookings.customer_id` dan `users.customer_id` (khusus CUSTOMER; akun non-CUSTOMER tetap NULL).
10. FK + indeks.
11. `DROP COLUMN users.company_name`, `DROP COLUMN users.auto_approve_booking`.
12. Tulis **satu baris `audit_logs`** `CUSTOMER_MASTER_MIGRATED` berisi ringkasan penggabungan
    (jumlah akun, jumlah customer, daftar nama yang digabung) — keputusan 4.2.

**Verifikasi setelah migrasi** (dijalankan sebagai query, bukan asumsi):

```sql
-- Tidak boleh ada booking tanpa pemilik perusahaan
SELECT count(*) FROM bookings WHERE customer_id IS NULL;              -- harus 0
-- Tidak boleh ada akun CUSTOMER tanpa perusahaan
SELECT count(*) FROM users WHERE role='CUSTOMER' AND customer_id IS NULL; -- harus 0
-- Tidak boleh ada nama customer duplikat secara case-insensitive
SELECT lower(name), count(*) FROM customers GROUP BY 1 HAVING count(*) > 1; -- harus kosong
-- Relasi lama harus tetap utuh: jumlah booking tidak berubah
SELECT count(*) FROM bookings;                                       -- sama seperti sebelum migrasi
```

**Kondisi awal yang sudah dipastikan** (diperiksa pada DB dev sebelum menulis dokumen ini):

| Fakta | Nilai |
| :--- | :--- |
| FK `bookings_customer_id_fkey` | `FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT` |
| Indeks `bookings_customer_id_booking_date_idx` | `(customer_id, booking_date)` — ikut pindah saat rename |
| Akun CUSTOMER di DB dev | 2, keduanya punya `company_name` → tidak ada fallback yang terpakai |
| Tabel `users` | tanpa indeks tambahan; aman menambah `customer_id` |
| Booking dev | 11 baris |

---

## 4. Aturan bisnis

### 4.1 Kepemilikan dan otorisasi

| Endpoint | Aturan baru |
| :--- | :--- |
| `GET /api/bookings/my-list` | `where: { customerId: user.customerId }` |
| `GET /api/bookings/:id` | CUSTOMER boleh bila `booking.customerId === user.customerId` |
| `PATCH /api/bookings/:id/vehicle-info` | idem |
| `POST /api/bookings/:id/cancel` | idem |

Akun CUSTOMER tanpa `customerId` (tidak mungkin setelah migrasi, tapi dijaga) → `403` dengan pesan
yang jelas, bukan daftar kosong.

### 4.2 Pembuatan booking

`POST /api/bookings` mengisi:
- `customerId: user.customerId` (wajib; server menolak bila null)
- `createdById: user.id`

Whitelist approval dibaca dari **customer**, bukan user:

```ts
needsApproval({
  approvalMode: settings.approvalMode,
  role: user.role,
  autoApproveBooking: customer.autoApproveBooking,
})
```

### 4.3 Realtime

- `rooms.customer(customerId) = 'customer:' + customerId`.
- `resolveIdentity` mengembalikan `{ userId, role, customerId }`; socket CUSTOMER bergabung ke
  `rooms.customer(customerId)` **dan** `rooms.user(userId)`.
- `emitBookingUpdated` mengirim ke `rooms.customer(payload.customerId)` — bukan lagi
  `rooms.user(...)`. Tiket publik (`ticket:<qrToken>`) tidak berubah.
- `RealtimeEvent.booking.updated` menambah `customerId` supaya klien bisa memfilter.

### 4.4 Hapus dan nonaktifkan customer

- `DELETE /api/customers/:id` hanya bila `users` dan `bookings` kosong → jika tidak,
  `409 CUSTOMER_IN_USE` dengan jumlah penghalang.
- Menonaktifkan customer (`isActive = false`) **tidak** menonaktifkan akunnya, tetapi akun itu
  ditolak saat booking dengan `403 CUSTOMER_INACTIVE`.
- Menonaktifkan akun tetap seperti sekarang (`PATCH /api/users/:id`).

### 4.5 Akun di dalam customer

- `POST /api/customers/:id/users` — `{ name, email, password, phone? }`; role selalu `CUSTOMER`.
- `PATCH /api/customers/:id/users/:userId` — nama, telepon, `isActive`, `password`.
- Email tetap unik global di `users`.
- Password awal diisi Admin (keputusan 3.6), minimal 7 karakter seperti sekarang.

### 4.6 `POST /api/users`

Menolak `role: 'CUSTOMER'`:

```
409 CUSTOMER_VIA_MASTER
"Akun Customer dibuat dari Master Data Customer, bukan dari halaman Pengguna."
```

`GET /api/users` menyembunyikan akun CUSTOMER secara default; `?role=CUSTOMER` tetap diizinkan
untuk kebutuhan audit, tetapi UI Pengguna tidak menampilkannya.

### 4.7 Laporan

- `GET /api/reports/kpi?from&to&customerId` — opsional, kosong berarti semua customer.
- `GET /api/reports/export.xlsx?from&to&customerId` — parameter sama.
- Kolom **Customer** di Excel berisi `customers.name`.
- `ReportRow.customer` di frontend tetap `string` (nama perusahaan), sehingga tabel laporan tidak
  perlu berubah bentuk.

### 4.8 Audit

| Action | Pemicu |
| :--- | :--- |
| `CUSTOMER_MASTER_MIGRATED` | migrasi data (sekali) |
| `CUSTOMER_CREATED` / `CUSTOMER_UPDATED` | CRUD master |
| `CUSTOMER_DEACTIVATED` | `isActive: false` |
| `CUSTOMER_DELETED` | hapus kosong |
| `CUSTOMER_APPROVAL_FLAG_CHANGED` | perubahan `autoApproveBooking` |

Action lama `USER_APPROVAL_FLAGS_CHANGED` kini hanya mencakup `canApproveBooking`.

---

## 5. Kontrak API

### 5.1 Baru

| Method | Path | Akses |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | ADMIN (semua), staf lain read-only bila perlu |
| `POST` | `/api/customers` | ADMIN |
| `GET` | `/api/customers/:id` | ADMIN |
| `PATCH` | `/api/customers/:id` | ADMIN |
| `DELETE` | `/api/customers/:id` | ADMIN |
| `POST` | `/api/customers/:id/users` | ADMIN |
| `PATCH` | `/api/customers/:id/users/:userId` | ADMIN |
| `GET` | `/api/customers/options` | staf (untuk filter laporan) |

### 5.2 Berubah

| Endpoint | Perubahan |
| :--- | :--- |
| `GET /api/bookings/*` | `customer` kini objek `Customer`; field baru `createdBy: { id, name }` |
| `POST /api/bookings` | Menolak akun tanpa customer |
| `GET/PATCH /api/users` | Menolak/menyembunyikan CUSTOMER; `companyName` dihapus dari respons |
| `GET /api/reports/*` | Parameter `customerId`; label memakai `customers.name` |
| `GET /api/auth/me` | Menambah `customerId`, membuang `companyName` |
| `POST /api/auth/login` | idem |

### 5.3 Bentuk `bookingSelect`

```ts
customer: { select: { id: true, name: true, code: true } },
createdBy: { select: { id: true, name: true } },
```

---

## 6. Frontend

### 6.1 Halaman & komponen

| Berkas | Aksi |
| :--- | :--- |
| `src/features/master/customer-section.tsx` | **Baru** — tabel customer, cari, tambah/edit |
| `src/features/master/customer-dialog.tsx` | **Baru** — form profil + daftar akun |
| `src/features/master/index.tsx` | Tab keempat **Customer** + ringkasan |
| `src/features/users/index.tsx` | Buang kolom/filter customer; hanya Admin/Security/Checker |
| `src/features/reports/index.tsx` | Dropdown filter customer |
| 5 komponen yang membaca `customer.companyName ?? customer.name` | Ganti menjadi `customer.name` |
| `src/lib/api/{types,endpoints}.ts` | Tipe & fungsi baru |

### 6.2 Enam tempat yang wajib diubah

`src/features/scanner/index.tsx:106`, `queue/index.tsx:261`, `dock/index.tsx:117`,
`dashboard/components/schedule-table.tsx:108`, `dashboard/components/dock-grid.tsx:142`,
`approvals/index.tsx:237` — semuanya `customer.companyName ?? customer.name` → `customer.name`.

### 6.3 Detail customer

Satu dialog dengan dua bagian:
1. **Profil** — nama (wajib, unik), kode (read-only), alamat, kota, PIC, telepon, email perusahaan,
   NPWP, catatan, toggle **Booking otomatis**, toggle aktif.
2. **Akun login** — tabel akun: nama, email, aktif. Tombol *Tambah akun*, *Reset password*,
   *Nonaktifkan*.

---

## 7. Rencana test

### 7.1 Baru — `customer.test.ts`

1. Buat customer; nama duplikat (beda kapital) → `409`.
2. Kode otomatis `CUST-NNN` berurutan.
3. Edit profil; audit `CUSTOMER_UPDATED`.
4. Nonaktifkan customer → akunnya gagal booking `403 CUSTOMER_INACTIVE`.
5. Hapus customer kosong → `200`.
6. Hapus customer yang punya akun → `409 CUSTOMER_IN_USE`.
7. Hapus customer yang punya booking → `409 CUSTOMER_IN_USE`.
8. `POST /api/customers/:id/users` membuat akun role CUSTOMER tertaut.
9. `POST /api/users` dengan role CUSTOMER → `409 CUSTOMER_VIA_MASTER`.
10. `GET /api/users` tidak memuat akun CUSTOMER secara default.

### 7.2 Baru — `customer-ownership.test.ts`

11. Dua akun satu perusahaan: booking buatan akun A terlihat di `my-list` akun B.
12. Akun B boleh `GET /api/bookings/:id` milik akun A.
13. Akun B boleh membatalkan booking akun A (keputusan 3.2).
14. Akun dari **perusahaan lain** → `403` untuk lihat dan batal.
15. `createdById` mencatat akun pembuat, bukan penerima.
16. Whitelist approval: customer `autoApproveBooking=true` → booking `NOT_REQUIRED` walau mode
    MANUAL; customer lain → `PENDING`.
17. Laporan filter `customerId` hanya menghitung booking perusahaan itu.

### 7.3 Baru — `customer-migration.test.ts` (opsional, berat)

Bila dijalankan: seed dua akun dengan `companyName` sama, jalankan ulang logika penggabungan pada
tabel sementara, pastikan menghasilkan satu customer dan kedua akun tertaut. Bila terlalu rapuh,
ganti dengan verifikasi SQL pasca-migrasi di lingkungan nyata (lihat §3.4) dan catat hasilnya di
dokumen ini.

### 7.4 Tes lama yang wajib diperbaiki

`helpers.ts` (`seedBase` harus membuat customer dan menautkan akun), `bookings.test.ts`,
`concurrency.test.ts`, `no-show.test.ts`, `realtime.test.ts`, `users.test.ts`, `master.test.ts`,
`approval.test.ts`, `approval-quota.test.ts`, `approval-concurrency.test.ts`.

`realtime.test.ts` wajib ditambah satu kasus: **rekan seperusahaan menerima `booking.updated`**
(keputusan 3.1), karena inilah yang berubah dari sebelumnya.

---

## 8. Urutan pengerjaan

### Fase A — Skema & migrasi
1. Model `Customer`, perubahan `User`, `Booking`.
2. Migrasi `add_customer_master` + backfill + audit.
3. Verifikasi SQL pasca-migrasi (§3.4).
4. `prisma generate`.

### Fase B — Server (paling berisiko)
5. `customers` router (CRUD + akun).
6. Perbaiki 4 titik kepemilikan di `bookings/routes.ts`.
7. `POST /api/bookings` mengisi dua kolom; whitelist dari customer.
8. `bookingSelect` + `createdBy`.
9. Realtime: room `customer:`, `resolveIdentity`, `emitBookingUpdated`.
10. `POST /api/users` menolak CUSTOMER; `GET` menyembunyikan.
11. Laporan: parameter + kolom.
12. `auth/routes.ts` dan `middleware/auth.ts`: `customerId`, buang `companyName`.

### Fase C — Tes server
13. Perbaiki `helpers.ts` dan 9 berkas tes lama.
14. Tambah `customer.test.ts` dan `customer-ownership.test.ts`.

### Fase D — Frontend
15. Tipe & endpoint.
16. Tab Customer + dialog (profil + akun).
17. Bersihkan halaman Pengguna.
18. Ganti 6 pembacaan `companyName`.
19. Filter customer di laporan.
20. Perbaiki `auth-store.test.ts` dan tipe `SessionUser`.

### Fase E — Verifikasi
21. `tsc` app + server, `vite build`, `eslint`, `test:api`, `test` browser.
22. Uji manual: buat customer → buat akun → login akun itu → booking → rekan seperusahaan melihat.

---

## 9. Risiko & mitigasi

| Risiko | Mitigasi |
| :--- | :--- |
| Tiga kegagalan senyap karena `customerId` tetap `String` | Kolom lama di-rename `createdById`; kompilator memaksa audit semua pemakai |
| Migrasi menggabung perusahaan yang sebenarnya berbeda | Penggabungan hanya per `company_name` persis (trim + case-insensitive); hasil dicatat di audit; nama unik mencegah terulang |
| Booking lama kehilangan pemilik | Backfill `bookings.customer_id` dari `users.customer_id`; diverifikasi query nol-NULL sebelum `SET NOT NULL` |
| Customer kehilangan akses setelah migrasi | Tes #11–#13 membuktikan dua akun seperusahaan tetap bisa lihat dan batal |
| Realtime mati tanpa error | Room `customer:<id>` + tes rekan seperusahaan |
| Admin mengira akun customer dibuat dari Pengguna | `POST /api/users` menolak dengan pesan yang menunjuk ke Master Data |
| Hapus customer memutus riwayat | `DELETE` hanya bila tidak punya booking/akun |
| Nama customer kosong saat migrasi | Fallback `Customer <email>` (keputusan 4.1), dicatat di audit untuk dirapikan |

---

## 10. Pertanyaan terbuka

1. **Akun non-CUSTOMER pada halaman Pengguna** — setelah `companyName` dihapus dari `users`,
   Admin/Security/Checker tidak punya kolom perusahaan lagi. Saat ini seed mengisi
   `companyName: 'TSB Warehouse'` untuk Admin. Usulan: buang; tidak ada yang memakainya.
2. **`GET /api/customers` untuk non-ADMIN** — Checker mungkin perlu daftar nama untuk layar
   antrean. Usulan: cukup lewat objek `booking.customer`; tidak perlu akses daftar penuh.
3. **Kode customer** — `CUST-001` berurutan per tabel. Bila customer dihapus, nomor tidak dipakai
   ulang. Usulan: `MAX(code)+1` di dalam transaksi; lubang nomor diterima.

### Keputusan yang diambil saat eksekusi

1. **`companyName` dibuang seluruhnya**, termasuk untuk Admin di seed. Tidak ada konsumen yang
   memakainya setelah booking memakai `customers.name`.
2. **`GET /api/customers` tetap ADMIN-only.** Checker sudah mendapat nama perusahaan lewat
   `booking.customer.name`. Ditambahkan `GET /api/customers/options` (tanpa kontak) untuk dropdown
   filter laporan, terbuka bagi semua staf yang login.
3. **Kode memakai `MAX`, bukan `COUNT`.** Nomor tidak pernah dipakai ulang setelah penghapusan,
   sehingga kode customer tidak pernah menunjuk dua entitas berbeda di riwayat percakapan.

---

## 11. Status eksekusi

Semua fase A–E selesai dan terverifikasi pada DB nyata (11 booking, 2 customer hasil migrasi).

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npx prisma migrate deploy` | 5 migrasi diterapkan; `add_customer_master` sukses |
| Verifikasi SQL pasca-migrasi | 0 booking tanpa customer; 0 akun CUSTOMER tanpa perusahaan; 0 nama duplikat; 11 booking utuh |
| Backfill | 2 customer (`CV Mitra Niaga`, `PT Sinar Jaya Logistik`), masing-masing 1 akun; 11 booking tertaut |
| Audit migrasi | `CUSTOMER_MASTER_MIGRATED` mencatat 2 customer / 2 akun / 11 booking |
| `npx tsc` app + server | 0 error |
| `npx vite build` | lolos |
| `npx eslint .` | 0 error (5 warning bawaan, 1 di antaranya pola `export function` yang sama seperti `status-badge.tsx`) |
| `npm run test:api` | **122 tes lolos** (14 berkas) — naik dari 97 |
| `npm test` (browser) | 64 tes lolos |
| Uji UI nyata | Tab **Customer** menampilkan 2 customer + jumlah akun/booking; dialog Tambah customer terbuka dengan 7 field; halaman Pengguna hanya 5 akun staf; Laporan punya dropdown "Semua customer" |
| Uji API nyata | Buat customer `CUST-003` → buat akun → login → booking (`customer=PT Uji E2E`, `createdBy=Staf Uji`) → `POST /users` CUSTOMER ditolak 409 → hapus customer berisi ditolak 409 |

### Bug yang ditemukan dan diperbaiki saat eksekusi

| Bug | Penyebab | Perbaikan |
| :--- | :--- | :--- |
| `CREATE` customer gagal `500` / `invalid input syntax for type integer: "CUST-001"` | Di template literal JS, `\D` menjadi `D`, sehingga regex menghapus huruf D dan `::int` gagal | Escape `\\D` di `nextCustomerCode` |
| `Argument customer is missing` pada 17 tes | `customerId` kini wajib dan `createdById` belum diisi di tes | `helpers.ts` membuat 2 customer + menautkan akun; tambah `createdById` di semua `prisma.booking.create` |
| `Unknown argument autoApproveBooking` | Flag pindah ke `customers` | Tes whitelist memakai `prisma.customer.update` |
| `Migration failed: column users.email must appear in GROUP BY` | Window function mereferensikan kolom tak teragregasi | Backfill memakai subquery ber-`GROUP BY` lebih dulu |

### Berkas baru

| Berkas | Isi |
| :--- | :--- |
| `server/prisma/migrations/20261109120000_add_customer_master/migration.sql` | Tabel, backfill, rename kolom, FK, indeks, audit |
| `server/src/modules/customers/routes.ts` | CRUD customer + akun + `assertActiveCustomer` |
| `server/test/customer.test.ts` | 13 tes master data & akun |
| `server/test/customer-ownership.test.ts` | 11 tes kepemilikan, whitelist, laporan |
| `src/features/master/customer-section.tsx` | Tabel customer + dialog profil/akun |

### Berkas yang diubah

`server/prisma/schema.prisma`, `server/src/modules/{bookings,users,auth,ops,reports,public-ticket,approvals}/*`,
`server/src/{realtime/index.ts,middleware/auth.ts,app.ts,jobs/*}`, `server/test/*` (9 berkas),
`src/lib/api/{types,endpoints,client}.ts`, `src/features/{master,users,reports,queue,scanner,dock,approvals,dashboard}/*`,
`src/stores/auth-store.test.ts`.
