# Arsitektur Sistem & Skema Database

Dokumen ini menjelaskan arsitektur teknis aplikasi, mekanisme *real-time*, pencegahan *double-booking*, serta rancangan tabel database PostgreSQL.

---

## 1. Diagram Arsitektur Aliran Data

```
[Client Layer - Browser]
 ├── Desktop Web (React.js) ──> Admin Dashboard & Customer Portal
 └── Mobile Web (React.js)  ──> Driver QR Ticket, Security Scanner, Checker App
          │
          │  HTTPS (REST API + WebSocket / Socket.io)
          ▼
[Reverse Proxy / SSL Termination]
 └── Nginx / Cloudflare (Wajib HTTPS untuk izin akses Kamera Browser HP)
          │
          ▼
[Application Layer - Backend]
 └── Node.js (NestJS / Express)
      ├── Quota & Duration Calculation Engine
      ├── Transactional Booking Service (Row-Level Locking)
      └── Real-time Event Broadcaster (Socket.io)
          │
          │  TCP Connection Pool (Prisma / TypeORM / pg-pool)
          ▼
[Data Layer - Database]
 └── PostgreSQL (ACID Compliant Relational Database)
```

---

## 2. Mekanisme Pencegahan Bentrok Kuota (Concurrency Control)
Saat 2 atau lebih Customer menekan tombol *Book* pada jam yang sama ketika sisa kuota tinggal 1, sistem menggunakan **PostgreSQL Transaction dengan Lock** agar tidak terjadi *over-quota*:

1. Mulai transaksi database (`BEGIN`).
2. Kunci baris konfigurasi kuota pada tanggal dan aktivitas terkait menggunakan `SELECT ... FOR UPDATE`.
3. Hitung ulang total truk yang aktif pada setiap blok 30 menit di rentang jam yang diminta.
4. Jika seluruh blok 30 menit masih memiliki `terpakai < maksimal_kuota`, simpan data *booking* (`INSERT`) lalu `COMMIT`.
5. Jika ada satu saja blok yang penuh, batalkan transaksi (`ROLLBACK`) dan kirimkan pesan ke layar Customer: *"Maaf, kuota pada jam tersebut baru saja terisi. Silakan pilih jam lain."*

---

## 3. Rancangan Skema Database (PostgreSQL)

### Tabel 1: `users`
Menyimpan seluruh akun pengguna (Admin, Customer, Security, Checker). Supir tidak masuk ke tabel ini karena mengakses via *public token*.
* `id` (UUID, Primary Key)
* `name` (VARCHAR)
* `company_name` (VARCHAR, Nullable - khusus Customer)
* `email` (VARCHAR, Unique)
* `phone` (VARCHAR)
* `password_hash` (VARCHAR)
* `role` (ENUM: `'ADMIN'`, `'CUSTOMER'`, `'GATE_OFFICER'`, `'CHECKER'`)
* `is_active` (BOOLEAN, Default: `true`)
* `created_at` (TIMESTAMPTZ)

### Tabel 2: `warehouse_settings`
Menyimpan parameter operasional gudang dan aturan kuota.
* `id` (INT, Primary Key)
* `operating_start_time` (TIME, contoh: `'08:00:00'`)
* `operating_end_time` (TIME, contoh: `'17:00:00'`)
* `slot_unit_minutes` (INT, Default: `30`)
* `grace_period_minutes` (INT, Default: `15` - toleransi keterlambatan)
* `max_loading_quota_per_slot` (INT, contoh: `2`)
* `max_unloading_quota_per_slot` (INT, contoh: `4`)

### Tabel 3: `truck_types`
Master jenis armada beserta durasi otomatisnya.
* `id` (SERIAL, Primary Key)
* `truck_name` (VARCHAR, contoh: `'CDD / Fuso'`, `'Container 40ft'`)
* `duration_minutes` (INT, contoh: `60`, `120`)
* `blocks_required` (INT, contoh: `2`, `4`)
* `is_active` (BOOLEAN)

### Tabel 4: `docks`
Master daftar pintu *dock* fisik di gudang untuk dialokasikan oleh Admin.
* `id` (SERIAL, Primary Key)
* `dock_code` (VARCHAR, contoh: `'DOCK-01'`, `'DOCK-02'`)
* `allowed_activity` (ENUM: `'LOADING'`, `'UNLOADING'`, `'BOTH'`)
* `current_status` (ENUM: `'AVAILABLE'`, `'OCCUPIED'`, `'MAINTENANCE'`)
* `current_booking_id` (UUID, Nullable - referensi truk yang sedang menempati *dock*)

### Tabel 5: `bookings`
Tabel transaksi utama pemesanan slot waktu.
* `id` (UUID, Primary Key)
* `booking_code` (VARCHAR, Unique, contoh: `'TSB-20261107-001'`)
* `qr_token` (VARCHAR, Unique Index - *hash* acak untuk URL tiket Supir & isi QR Code)
* `customer_id` (UUID, Foreign Key $\rightarrow$ `users.id`)
* `activity_type` (ENUM: `'LOADING'`, `'UNLOADING'`)
* `truck_type_id` (INT, Foreign Key $\rightarrow$ `truck_types.id`)
* `booking_date` (DATE)
* `start_time` (TIMESTAMPTZ - jam mulai sesuai pilihan kuota)
* `end_time` (TIMESTAMPTZ - otomatis dihitung dari `start_time + duration_minutes`)
* `reference_doc_no` (VARCHAR - Nomor DO/PO/Surat Jalan)
* `license_plate` (VARCHAR, **Nullable** - boleh dikosongkan saat awal)
* `driver_name` (VARCHAR, **Nullable** - boleh dikosongkan saat awal)
* `driver_phone` (VARCHAR, **Nullable**)
* `assigned_dock_id` (INT, Nullable, Foreign Key $\rightarrow$ `docks.id`)
* `status` (ENUM: `'BOOKED_INCOMPLETE'`, `'BOOKED_READY'`, `'CHECKED_IN_ON_TIME'`, `'LATE_WAITING_LIST'`, `'DOCK_ASSIGNED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CHECKED_OUT'`, `'CANCELLED'`, `'NO_SHOW'`)
* `late_minutes` (INT, Default: `0`)
* `created_at` (TIMESTAMPTZ)
* `updated_at` (TIMESTAMPTZ)

### Tabel 6: `booking_time_logs`
Mencatat jejak waktu aktual (*timestamps*) di lapangan untuk perhitungan KPI dan Audit Trail.
* `id` (UUID, Primary Key)
* `booking_id` (UUID, Unique Foreign Key $\rightarrow$ `bookings.id`)
* `vehicle_completed_at` (TIMESTAMPTZ - waktu saat data plat/supir dilengkapi)
* `gate_in_at` (TIMESTAMPTZ)
* `gate_in_by` (UUID, Foreign Key $\rightarrow$ `users.id` [Security])
* `dock_assigned_at` (TIMESTAMPTZ)
* `dock_assigned_by` (UUID, Foreign Key $\rightarrow$ `users.id` [Admin])
* `process_started_at` (TIMESTAMPTZ)
* `process_started_by` (UUID, Foreign Key $\rightarrow$ `users.id` [Checker])
* `process_completed_at` (TIMESTAMPTZ)
* `process_completed_by` (UUID, Foreign Key $\rightarrow$ `users.id` [Checker])
* `gate_out_at` (TIMESTAMPTZ)
* `gate_out_by` (UUID, Foreign Key $\rightarrow$ `users.id` [Security])