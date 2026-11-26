# Rencana Implementasi Warehouse TSB

Dokumen kerja untuk membangun aplikasi **Warehouse Time Slot Booking** dari enam dokumen di
`docs/prd/`. Dokumen ini mencatat keputusan yang sudah dikunci lewat sesi grilling, apa yang
dipertahankan dari repo, urutan pengerjaan, dan cara memverifikasi tiap fase.

Sumber kebutuhan: `docs/prd/product_requirements_document.md`,
`docs/prd/arsitektur_sistem_skema_database.md`,
`docs/prd/aturan_bisnis_logika_sistem.md`,
`docs/prd/alur_pengguna_end_to_end.md`,
`docs/prd/rencana_pengembangan_endpoint_api.md`,
`docs/prd/spesifikasi_tech_stack_infrastruktur_server.md`.

---

## 1. Keputusan yang sudah dikunci

| Topik | Keputusan | Konsekuensi |
| :--- | :--- | :--- |
| Cakupan | Full-stack end-to-end, satu gudang operasional (v1) | Kuota, booking, dan laporan tetap satu gudang. Tabel `warehouses` ada hanya sebagai metadata untuk menandai gudang tiap dock — tidak memecah kuota |
| Backend | Express + Prisma, di dalam repo ini (`server/`) | Satu repo, dua proses dev |
| Auth | JWT + bcrypt sendiri, role-based | Seluruh kode Clerk dicabut |
| Kuota | **Turunan dari master dock** | `max_*_quota_per_slot` dihapus dari settings |
| Walk-in | Tidak untuk v1 | Tombol dan feed walk-in dibuang |
| Deploy | On-prem gudang + Cloudflare Tunnel | HTTPS dari Cloudflare, tanpa VPS publik |
| Jendela booking | H+7 | Validasi di availability & create |
| Admin sebagai petugas | Boleh, dengan jejak audit | Tabel `audit_logs` mencatat role saat aksi |
| Zona waktu | Asia/Jakarta untuk perhitungan, UTC di DB | Semua boundary blok dihitung di zona Jakarta |

### Koreksi terhadap PRD

Empat hal di PRD tidak bisa dijalankan apa adanya dan sudah diganti:

1. **Anti-double-booking.** PRD meminta `SELECT ... FOR UPDATE` pada "baris konfigurasi kuota
   pada tanggal dan aktivitas", tetapi `warehouse_settings` tidak punya kolom tanggal maupun
   aktivitas. Diganti dengan tabel `slot_allocations` — satu baris per (tanggal, aktivitas, blok
   30 menit) — dan baris itulah yang dikunci.
2. **Kuota vs jumlah dock.** PRD menyimpan kuota sebagai angka manual sekaligus punya master
   dock. Dua sumber ini bisa bertentangan. Kuota sekarang dihitung: jumlah dock aktif yang
   mengizinkan aktivitas tersebut. Admin mengatur kapasitas dengan menambah/menonaktifkan dock.
3. **Kedatangan terlalu awal.** PRD memberi `CHECKED_IN_ON_TIME` untuk truk yang datang jauh
   lebih awal tanpa batas. Ditambahkan `early_arrival_limit_minutes` (default 60): lebih awal
   dari itu gate-in ditolak dan Security diminta menunggu.
4. **Kapan booking dianggap NO_SHOW.** PRD tidak mengaturnya, dan menerapkannya pada `end_time`
   booking membuat truk yang datang 10 menit setelah jadwal sudah ditolak di gerbang — bertabrakan
   dengan janji bahwa QR tidak hangus. Patokannya sekarang akhir hari operasional
   (`isOperationalDayOver`), sehingga truk terlambat masih bisa masuk `LATE_WAITING_LIST` selama
   gudang buka.

---

## 2. Apa yang dipakai dan dibuang dari repo

Repo sekarang adalah template `shadcn-admin` v2.2.1 (React 19, TanStack Router/Query/Table,
Tailwind v4, Vite 8, Vitest browser mode) dengan satu dashboard TSB statis.

**Dibuang**

- `src/routes/clerk/**`, `src/features/chats/**`, `src/features/apps/**`,
  `src/features/tasks/**`, `src/routes/_authenticated/help-center/**`
- Seluruh komponen Clerk (`src/assets/clerk-*`), dependensi `@clerk/react`
- Data faker (`@faker-js/faker`) dan `src/features/tsb-admin/data.ts` setelah API tersedia
- `netlify.toml`

**Dipakai ulang**

- Semua `src/components/ui/**`, layout sidebar/header, tema, `components/data-table/**`
- `src/features/users/**` → dijadikan **Manajemen Pengguna** (Admin membuat akun Security,
  Checker, Customer)
- `src/features/tsb-admin/**` → kerangka visual dashboard Admin, datanya disambungkan ke API

**Diubah**

- `package.json`: nama `warehouse-tsb`, tambah script `dev:web`, `dev:api`, `dev`, `db:*`
- `src/stores/auth-store.ts`: tidak lagi menyimpan token di cookie yang bisa dibaca JS

---

## 3. Struktur target

```
warehouse-tsb/
+-- src/                        # frontend (Vite, root sekarang)
—   +-- routes/
—   —   +-- (auth)/sign-in.tsx
—   —   +-- t/$token.tsx         # tiket supir publik
—   —   +-- _authenticated/      # admin, customer, gate, checker (terlindungi)
—   +-- features/
—   —   +-- auth/                # form masuk
—   —   +-- bookings/            # buat booking, booking saya, detail
—   —   +-- ticket/              # tiket supir + QR
—   —   +-- scanner/             # kamera QR, gate & dock
—   —   +-- dashboard/           # monitoring realtime
—   —   +-- queue/  dock/        # antrean & papan dock
—   —   +-- master/              # dock, jenis truk
—   —   +-- reports/             # KPI + ekspor
—   —   +-- users/  settings/
—   +-- lib/api/                # axios instance + tipe respons
—   +-- lib/socket.ts
+-- server/
—   +-- prisma/schema.prisma
—   +-- prisma/seed.ts
—   +-- src/
—   —   +-- app.ts
—   —   +-- config/
—   —   +-- middleware/         # auth, rbac, error, validate
—   —   +-- modules/            # auth, settings, master, bookings,
—   —   —                       # slots, public-ticket, ops, reports, users
—   —   +-- realtime/           # socket.io rooms
—   —   +-- lib/quota.ts        # engine kuota (murni, mudah dites)
—   +-- test/
—   +-- vitest.config.mts      # environment node
+-- docker-compose.yml          # postgres + api untuk dev
+-- docker-compose.prod.yml     # nginx + api + postgres untuk produksi
```

Rute yang benar-benar ada (bukan rencana awal):

```
src/routes/
+-- (auth)/sign-in.tsx           # halaman masuk tunggal
+-- t/$token.tsx                # tiket supir publik (qr_token)
+-- _authenticated/
—   +-- route.tsx                # guard sesi + layout
—   +-- index.tsx  dashboard.tsx  queue.tsx  dock.tsx  scan.tsx  reports.tsx
—   +-- master.tsx  settings.tsx  users.tsx
—   +-- bookings/index.tsx  bookings/new.tsx  bookings/$bookingId.tsx
```

Frontend dan server berbagi satu `package.json` di root? **Tidak.** `server/` punya
`package.json` sendiri supaya dependensi backend tidak masuk bundle frontend dan tipe Node tidak
bentrok dengan `tsconfig.app.json`.

---

## 4. Model data

Mengikuti PRD dengan koreksi di atas.

| Tabel | Perubahan dari PRD |
| :--- | :--- |
| `users` | `company_name` **dihapus** → `customer_id` (FK `customers`, wajib untuk CUSTOMER). `auto_approve_booking` pindah ke `customers`. Tidak ada `acting_role`; role tetap satu |
| `warehouse_settings` | Hapus `max_loading_quota_per_slot`, `max_unloading_quota_per_slot`; tambah `early_arrival_limit_minutes`, `booking_window_days`, dan empat kolom kebijakan approval |
| `truck_types` | Tetap (`duration_minutes`, `blocks_required`); `blocks_required` hanya turunan `ceil(duration/30)` dan tidak pernah diterima dari klien |
| `customers` | **Baru**: perusahaan customer (`name` unik case-insensitive, `code`, kontak, `auto_approve_booking`). Pemilik bisnis booking |
| `bookings` | `customer_id` **di-rename** → `created_by_id` (akun pembuat) + `customer_id` baru (perusahaan); `blocks_locked` snapshot; tujuh kolom approval. Lihat `docs/rencana-master-customer.md` dan `docs/rencana-approval-booking.md` |
| `docks` | Tambah `area_name` (teks bebas, boleh kosong) dan `warehouse_id` (wajib, FK ke `warehouses`); `current_status` tetap untuk tampilan cepat, sumber kebenaran tetap `bookings.status` |
| `warehouses` | **Baru**: `name` unik, `is_active`. Metadata pengelompokan saja — tidak dipakai mesin kuota |
| `booking_time_logs` | Tetap |
| `slot_allocations` | **Baru**: `slot_date`, `activity`, `slot_start`, `capacity`, `used`, unique `(slot_date, activity, slot_start)` |
| `audit_logs` | **Baru**: `user_id`, `user_role`, `acting_as_role`, `action`, `booking_id`, `meta`, `created_at` |

Catatan perilaku:

- `capacity` disimpan sebagai snapshot saat baris dibuat, supaya laporan historis tidak berubah
  ketika Admin menambah dock.
- Pembatalan mengembalikan `used` pada semua blok yang tertutup booking tersebut.
- Cron `NO_SHOW` berjalan setiap 10 menit dan menandai booking yang **hari operasionalnya sudah
  berakhir** (bukan saat `end_time` booking lewat) tanpa pernah gate-in; kuotanya dikembalikan.
  Dengan patokan ini truk yang datang terlambat masih bisa dipindai dan masuk
  `LATE_WAITING_LIST` selama gudang buka, sesuai janji PRD bahwa QR tidak hangus.
- Booking `COMPLETED` tidak otomatis membebaskan kuota; kuota sudah terpakai sejak booking dibuat.

---

## 5. Kontrak API

Mengikuti `rencana_pengembangan_endpoint_api.md`, dengan tambahan:

- `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/bookings/:id`, `GET /api/ops/queue` (antrean on-time + late untuk dashboard),
  `GET /api/ops/dock-worklist`, `POST /api/ops/no-show` (penanda manual)
- `GET /api/slots/availability?date&activity`
- `GET /api/reports/kpi?from&to`, `GET /api/reports/export.xlsx`
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` (Admin)
- `GET /api/master/truck-types`, `GET /api/master/docks`, `POST/PATCH` (Admin)
- `GET /api/health`

Master jenis truk bisa diubah lewat halaman Master Data (`PATCH /api/master/truck-types/:id`):
nama, durasi, urutan, dan status aktif. `blocks_required` **tidak** diterima dari klien — server
menghitungnya ulang dari durasi (`ceil(duration/30)`), sehingga angka di layar tidak mungkin
berbeda dari yang dipakai mesin kuota.

Durasi boleh diubah kapan saja, tapi **jumlah blok sebuah booking sudah di-snapshot** di
`bookings.blocks_locked` saat booking dibuat. Pembatalan, gate-out, dan cron NO_SHOW melepas
`blocks_locked`, bukan `truckType.blocksRequired` sekarang — tanpa itu, memperpendek durasi dari
90 ke 60 menit membuat booking lama hanya melepas 2 dari 3 blok yang terkunci, dan 1 blok bocor
permanen dari kuota.

Token: access 15 menit + refresh 7 hari, keduanya cookie `httpOnly`, `SameSite=Lax`, `Secure`
saat produksi. Frontend memanggil `/api/auth/me` saat boot; `auth-store` hanya menyimpan profil.

Realtime (Socket.io): identitas diambil **dari cookie sesi pada handshake**, tidak pernah dari
data kiriman klien. Room: `staff` (Admin/Checker/Security), `admin`, `user:<id>`, dan
`ticket:<qr_token>`. Tiket supir bergabung lewat `qr_token` tanpa login.
Event: `booking.updated`, `dock.updated`, `queue.updated`. `queue.updated` adalah ping tanpa isi
untuk menyegarkan daftar, jadi tidak membocorkan data booking milik customer lain.

Room `dock:<id>` dan `booking:<id>` sempat ditulis di draf awal lalu dicabut: tidak ada klien yang
pernah bergabung ke sana, sehingga event yang dikirim ke dua room itu selalu hilang. Yang benar-benar
membutuhkannya — papan dock dan detail booking — sudah tercakup `staff` dan `user:<id>`.

---

## 6. Fase pengerjaan

### Fase 0 — Fondasi repo

- [x] Ganti nama paket, rapikan script `dev:web` / `dev:api` / `dev` / `db:*`
- [x] `docker-compose.yml` dengan Postgres 16 + healthcheck
- [x] Scaffold `server/` (Express 5, TypeScript, Prisma, tsx watch)
- [x] `server/vitest.config.mts` (environment node) terpisah dari Vitest browser frontend
- [x] Cabut Clerk: hapus rute `clerk/**`, dependensi, dan pemakaian `ClerkProvider`
- [x] Hapus halaman demo (chats, apps, tasks, help-center), `netlify.toml`
- [x] `.env.example` di root (dibaca server/ dan Prisma CLI)

Verifikasi: `npm run build` lolos, `npm run dev` menyalakan web + api, `GET /api/health`
mengembalikan 200, `docker compose up -d` membuat Postgres sehat.

### Fase 1 — Skema, migrasi, seed

- [x] `schema.prisma` untuk 8 tabel + enum status
- [x] Migrasi awal, constraint unique `slot_allocations`
- [x] Seed: 1 admin, 2 customer, 2 security, 2 checker, 6 dock (4 unloading, 2 loading),
      4 jenis truk, settings 08:00—17:00, grace 15, early limit 60, window 7
- [x] Seed transaksi: satu hari penuh berisi booking di semua status untuk demo dashboard

Verifikasi: `npx prisma migrate dev`, `npm run db:seed`, inspeksi tabel.

### Fase 2 — Auth & RBAC

- [x] Register/login/refresh/logout, bcrypt, JWT
- [x] Middleware `requireAuth` dan `requireRole`
- [x] Endpoint `me`, manajemen pengguna oleh Admin
- [x] Halaman `/sign-in` tunggal + redirect per role
- [x] Guard rute TanStack untuk `_authenticated`, `/scan`, `/dock`

Verifikasi: tes integrasi di `server/test/users.test.ts` dan `server/test/settings.test.ts`
mencakup sesi per peran dan penolakan lintas role (403/401); `npm run test:api` menjalankannya.

### Fase 3 — Engine kuota & booking (inti risiko)

- [x] `lib/quota.ts` murni: fungsi blok yang tertutup, cek ketersediaan, hitung kapasitas
- [x] `POST /api/bookings` dalam satu transaksi: upsert `slot_allocations` per blok, `FOR UPDATE`
      berurutan menurut `slot_start`, tolak bila salah satu blok penuh
- [x] `GET /api/slots/availability`
- [x] `GET /api/bookings/my-list`, `PATCH /vehicle-info`, `POST /cancel`
- [x] Tes: dua booking paralel pada sisa 1 kuota → tepat satu berhasil
- [x] Tes: durasi 120 menit yang salah satu blok tengahnya penuh → ditolak
- [x] Tes: pembatalan mengembalikan kuota

Verifikasi: `npm run test:api`, termasuk tes konkurensi dengan dua koneksi Prisma terpisah.

### Fase 4 — Frontend customer & tiket supir

- [x] Halaman buat booking: tanggal, aktivitas, jenis truk, grid jam dengan sisa kuota
- [x] Form dokumen + data kendaraan opsional (`BOOKED_INCOMPLETE` vs `BOOKED_READY`)
- [x] Halaman Booking Saya + lengkapi data menyusul
- [x] Tiket publik `/t/$token`: QR besar hanya saat `BOOKED_READY`, status realtime
- [x] Tombol "Kirim via WhatsApp" (`wa.me`), unduh QR PNG, cetak PDF via CSS print
- [x] Supir boleh melengkapi plat/supir dari halaman tiket

Verifikasi: alur penuh di viewport 390—844 — booking tanpa data → QR terkunci → lengkapi →
QR muncul → status berubah saat ops memindai.

### Fase 5 — Lapangan & dashboard realtime

- [x] Scanner kamera (`html5-qrcode`) dengan fallback input kode manual
- [x] `/scan`: pratinjau data, tombol Gate-In / Gate-Out, warna hijau/kuning, blokir kedatangan
      lebih awal dari batas
- [x] `/dock`: daftar truk di dock saya, Start / Finish
- [x] `POST /api/ops/*` lengkap dengan audit log
- [x] Dashboard Admin: dock grid, antrean on-time, late waiting list, assign dock
- [x] Socket.io: perubahan status tampil di semua layar tanpa refresh

Verifikasi: `server/test/realtime.test.ts` (4 kasus) membuktikan handshake dengan cookie sesi masuk ke
room `staff` dan menerima `booking.updated`, sedangkan koneksi anonim tidak menerimanya; tiket supir
tanpa login menerima update booking-nya sendiri lewat `qr_token`; dan cookie yang access token-nya
sudah kedaluwarsa tetap dikenali lewat refresh token. Diuji juga terhadap server yang sedang
berjalan dengan `node scripts/verify-realtime.cjs`, dan secara manual di browser: mengubah status
lewat API langsung mengubah dashboard tanpa reload.

### Fase 6 — Laporan, KPI, deploy

- [x] Perhitungan waiting time, processing time, turnaround dari `booking_time_logs`
- [x] Halaman laporan + filter tanggal, ekspor `.xlsx` (exceljs)
- [x] Docker Compose produksi: nginx, api, postgres, volume, restart policy
- [x] Panduan Cloudflare Tunnel + HTTPS, pastikan kamera berjalan di HP
- [x] UAT: simulasi satu hari operasional

Verifikasi: ekspor Excel terbuka benar, KPI cocok dengan data seed, kamera berfungsi lewat
domain HTTPS.

---

## 7. Risiko

| Risiko | Mitigasi |
| :--- | :--- |
| Tes konkurensi lulus di lokal tapi gagal di produksi | Tes memakai dua koneksi nyata ke Postgres, bukan mock |
| Zona waktu meleset satu hari | Semua boundary blok dihitung di Asia/Jakarta, tes eksplisit untuk 23:30 dan 00:00 |
| Kamera diblokir di HP | Fallback input kode manual selalu tersedia |
| Admin menambah dock saat hari berjalan | `capacity` snapshot per baris; blok yang sudah lewat tidak diubah |
| Supir membuka tautan lama setelah hari berganti | Tiket menampilkan status final, QR tidak bisa dipakai ulang setelah `CHECKED_OUT` |
| Satu orang jaga semua pos | Admin dapat melakukan aksi gate/dock, tercatat di `audit_logs` |

### Risiko fitur persetujuan booking

Dokumen terpisah: **`docs/rencana-approval-booking.md`**. Ringkas:

| Risiko | Mitigasi |
| :--- | :--- |
| Kuota bocor karena rilis ganda | `quota_released_at` + `finalizeRelease` satu pintu; tes cancel→expire dan pemanggilan ganda |
| Job expire dan NO_SHOW berebut booking | Filter `approvalStatus` saling eksklusif di kedua job |
| Admin approve tepat saat expire | Compare-and-set `WHERE approval_status = 'PENDING'`; `approval-concurrency.test.ts` |
| Fitur mati saat rilis karena semua ter-whitelist | Mode rilis `AUTO`, flag customer default `false` |
| Customer kabur dari approval lewat booking mendesak | Bypass dihapus; tenggat `max(start-30m, createdAt+15m)` |

---

## 8. Keputusan yang menyusul

Empat pertanyaan terbuka di draf awal sudah dijawab saat implementasi:

1. **Nama gudang & domain.** Nama gudang diambil dari `warehouse_settings.warehouse_name` dan bisa
   diubah di **Pengaturan**; bawaan seed "Gudang TSB Cikarang". Domain produksi diisi lewat
   `APP_ORIGIN` / `PUBLIC_APP_URL` di `.env.production`, tidak di-hardcode.
2. **Format `booking_code`.** Berurutan per hari: `TSB-YYYYMMDD-NNN`, dibangkitkan di dalam
   transaksi yang sama dengan penguncian kuota.
3. **Nomor WhatsApp supir.** Disimpan apa adanya (tidak dipaksa `62...`); tautan `wa.me` dibuat
   dari digit nomor sehingga nomor lokal maupun internasional sama-sama jalan.
4. **Pengaturan dari UI.** Ada halaman **Pengaturan** (Admin) untuk nama gudang, jam operasional,
   satuan blok, masa tenggang, batas datang awal, dan jendela booking. Kuota per slot sengaja
   **tidak** diatur di sana karena nilainya turunan dari master dock.

---

## 9. Status verifikasi

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npm run build` (typecheck + Vite) | lolos |
| `npm run build:api` (tsc server) | lolos |
| `npm run lint` | 0 error (4 warning bawaan template) |
| `npm run test:api` | 122 tes lolos (14 berkas), termasuk konkurensi dua koneksi, kuota, auth, realtime, no-show, master, approval, dan customer |
| `npm test` (Vitest browser) | 64 tes lolos |
| Alur manual di browser | login 4 peran, booking, tiket, scan, dock, dashboard, laporan |
| Edit jenis truk di Master Data | dialog `Ubah` tersimpan dan tabel ikut berubah; `blocks_required` dihitung server (`master.test.ts`: 403 customer, abaikan `blocksRequired` dari klien, nonaktif tetap terlihat di master tapi hilang dari `/api/settings`, durasi di luar batas ditolak) |
| Nama Area & Warehouse dock | dialog `Ubah` dock menyimpan `areaName` (teks bebas, `null` mengosongkan) dan `warehouseId`; gudang nonaktif tetap muncul bila dock masih menunjuk ke sana; gudang yang masih berisi dock tidak bisa dimatikan (`master.test.ts`: 8 kasus) |
| Nama Area di layar operasional | area tampil sebagai `D1 · Area B` (atau baris kedua di tabel) pada Papan Dock (kartu, ubin, ubin mini, tabel, dialog konfirmasi), grid & jadwal Dashboard, Antrean, pindai gate/checker, detail booking, riwayat gate, laporan staf/customer + Excel, dan tiket supir; area kosong tidak ditampilkan. Pencarian Papan Dock ikut mencocokkan area. `bookingSelect` kini membawa `assignedDock.areaName`; tes: `gate-scan.test.ts`, `gate-history.test.ts`, `reports-staff.test.ts`, `checker-scan.test.ts`, `dock-views.test.tsx`, `dock-model.test.ts`, `booking-view.test.ts`, `ticket-card.test.tsx` |
| Migrasi `warehouses` pada data lama | 6 dock yang sudah ada otomatis menunjuk gudang pertama dari `warehouse_settings.warehouse_name`, sehingga nama di tiket supir tidak berubah |
| Snapshot blok booking | `no-show.test.ts`: durasi Tronton 90 → 60 menit setelah booking dibuat, NO_SHOW tetap melepas 3 blok (bukan 2) |
| `PUT /api/settings` tanpa `requireAuth` | diperbaiki; tes regresi di `server/test/settings.test.ts` (200 admin, 403 customer, 401 tanpa sesi) |
| Realtime setelah perbaikan | `realtime.test.ts` (4 kasus): petugas menerima `booking.updated`, tamu tidak, tiket lewat `qr_token`, refresh token dipakai saat access token habis |
| NO_SHOW | dihitung terhadap akhir hari operasional, bukan `end_time` booking; tes di `no-show.test.ts` |
| Form booking untuk Admin | `/bookings/new` dibatasi ke CUSTOMER, sama dengan aturan `POST /api/bookings` |
| Nonaktifkan akun sendiri | ditolak server (`CANNOT_DEACTIVATE_SELF`, `LAST_ADMIN`); switch-nya dimatikan di UI |
| Mode terang/gelap | pemilih tema di sidebar, header, dan Pengaturan; `resolvedTheme` diperbaiki agar ikut berubah saat OS berganti tema |
| Approval booking (fitur baru) | `approval.test.ts` (19), `approval-quota.test.ts` (8), `approval-concurrency.test.ts` (3): mode AUTO/MANUAL, whitelist, tenggat MAX, approve/reject/batch, kuota rilis tepat sekali, race approve vs expire, gate-in ditolak saat PENDING, KPI `expiredPending`. Rincian: `docs/rencana-approval-booking.md` |
| Master Data Customer (fitur baru) | `customer.test.ts` (13), `customer-ownership.test.ts` (11): CRUD, nama unik case-insensitive, kode `CUST-NNN`, akun di dalam customer, `POST /users` menolak CUSTOMER, dua akun seperusahaan berbagi booking, perusahaan lain 403, whitelist approval per perusahaan, filter laporan. Migrasi: 11 booking + 2 customer ter-backfill tanpa kehilangan data. Rincian: `docs/rencana-master-customer.md` |
| Desain tiket (fitur baru) | Delapan tata letak kartu supir dipilih Admin di Pengaturan → Preferensi → **Desain tiket**, disimpan di `warehouse_settings.ticket_design` dan dikirim lewat `/api/branding` karena halaman tiket tak punya sesi. Semua desain 360×482 dengan delapan nilai yang sama. `ticket-size.test.tsx` (tinggi DOM = `TICKET_HEIGHT`), `ticket-layout.test.tsx` (tiap baris teks DOM bertinta di kanvas pada ketinggian sama, toleransi 3 px), `ticket-image.test.ts`, `ticket-card.test.tsx`, `ticket-design-picker.test.tsx`, `logo.test.ts`, `settings.test.ts` (simpan, tolak nilai asing, kirim di branding). Dua cacat lama ikut diperbaiki: `valueOffset` 17 → 12/13, dan `print-color-adjust` agar kartu `NIGHT` tidak tercetak kosong. Rincian: `docs/rencana-desain-tiket.md` |
| Galat login | Login gagal memakai `INVALID_CREDENTIALS`, bukan `UNAUTHORIZED` (yang diterjemahkan jadi "Sesi tidak valid atau sudah berakhir"); pesannya memberi jalan keluar dan tetap satu untuk email tak dikenal/akun nonaktif/kata sandi salah. Galat tampil di dalam form (`role="alert"`) dengan fokus pindah ke kata sandi. `apiLimiter` → `TOO_MANY_REQUESTS`, `loginLimiter` → `TOO_MANY_ATTEMPTS`. Tes: `auth.test.ts`, `user-auth-form.test.tsx`, `src/lib/api/client.test.ts` |

| Pengaturan Akun (fitur baru) | Halaman `/account` untuk semua peran (sebelumnya menu "Pengaturan Akun" menuju `/settings` yang khusus Admin, sehingga peran lain berakhir 403). Profil (nama, nomor HP), ganti email (wajib isi ulang + kata sandi saat ini), ganti kata sandi (mencabut sesi lain, sesi ini tetap), dan jumlah perangkat dengan tombol "Keluarkan perangkat lain". Server: `GET/PATCH /api/account/profile`, `POST /api/account/email`, `POST /api/account/password`, `POST /api/account/sessions/revoke`; email lewat `/auth/me` kini menyertakan `phone`. Tes: `server/test/account.test.ts` (15), `src/features/account/form.test.ts` (20), `src/features/account/index.test.tsx` (8). Rincian: `docs/rencana-pengaturan-akun.md` |
| Teks footer (fitur baru) | Dua baris footer aplikasi ("© {tahun} …" dan "• lokasi · shift") bisa diganti Admin di Pengaturan → Merek. Kolom `warehouse_settings.footer_company` (200) dan `footer_location` (120); **null berarti teks bawaan yang mengikuti bahasa aktif**, jadi gudang yang tidak menyentuhnya tidak melihat perubahan. Dikirim lewat `GET /api/settings` dan `GET /api/branding` (footer ada di setiap layar yang sudah masuk). Tahunnya selalu dihitung, tidak disimpan. Tes: `server/test/settings.test.ts` (+3), `src/features/settings/form.test.ts` (+3), `src/components/layout/footer.test.tsx` (2). |
| Baris lokasi footer bisa disembunyikan | Sakelar "Tampilkan baris lokasi" di kartu yang sama; kolom `warehouse_settings.footer_show_location` (`BOOLEAN NOT NULL DEFAULT true`) masuk `FIELD_GROUPS.brand`, jadi ikut tombol **Simpan** dan penanda "belum disimpan". Saat dimatikan, pemisah "•" ikut hilang — kalau tidak, footer berakhir dengan bullet menggantung. Nilai `false` **wajib dikirim apa adanya** (`form.footerShowLocation`, bukan `|| null`): `undefined` berarti "jangan ubah", sehingga memakai `||` membuat sakelar tidak bisa dimatikan. Tes: `server/test/settings.test.ts` (+1), `src/features/settings/form.test.ts` (+1), `src/components/layout/footer.test.tsx` (+2). |
| Batas gudang per customer (fitur baru) | Tabel penghubung `customer_warehouses` (customerId, warehouseId). Admin memilih gudang di form Customer (Master → Customer); **daftar kosong berarti semua gudang** supaya customer lama tidak berhenti bisa ditugaskan saat migrasi. Server menolak penugasan dock di luar area dengan 409 `DOCK_WAREHOUSE_FORBIDDEN`; `GET /api/ops/checker/scan/:qr` mengirim `allowedWarehouse` per dock dan `eligible` ikut mempertimbangkannya. Di layar Antrean, dock terlarang **tetap tampil** di grup redup beserta alasan, bukan disembunyikan: kalau WH1 penuh dan WH2 kosong, checker harus bisa menjelaskan ke supir bahwa gudangnya ada, hanya bukan area customer itu. Kuota slot sengaja **tidak** dipecah per gudang (di luar lingkup). Tes: `server/test/customer-area.test.ts` (6), `src/features/queue/queue-model.test.ts`, `queue-card.test.tsx`, `src/components/dock-picker.test.tsx`. |
| Awalan kode booking bisa diganti (fitur baru) | Admin mengganti **tiga huruf/angka awalan** di Pengaturan → Identitas (mis. `TSB` → `TKT`), dengan pratinjau kode bertanggal hari ini. Hanya kode **baru** yang memakai awalan itu. Tiket lama tetap sah karena pengenalan kode bekerja dari **bentuk** (`[A-Z0-9]{3}-YYYYMMDD-NNN`), bukan dari huruf awalannya — mengunci ke awalan aktif akan mematikan tiket yang sudah tercetak. Kolom `warehouse_settings.booking_code_prefix` (`VARCHAR(3) NOT NULL DEFAULT 'TSB'`); Zod menolak bentuk lain dengan 400, dan `normalizeBookingCodePrefix()` menjatuhkan nilai tak sah di DB ke bawaan. `nextFreeSequence()` melewati nomor yang sudah terpakai (penghitung tertinggal/data impor). Tes: `server/test/gate-scan.test.ts` (+2, termasuk tiket TSB lama setelah awalan diganti), `server/test/booking-code.test.ts` (6), `src/features/scanner/scan-input.test.ts` (+1), `src/features/settings/form.test.ts` (+2). |
| Master "Jenis Proses" (fitur baru) | Admin mengisi cara penanganan barang di Master → **Jenis Proses** (mis. Curah 30 menit, Palletize 15 menit). Customer **wajib memilihnya** saat membuat booking, dan durasinya **menambah** durasi jenis truk: `60 + 30 = 90` menit → `blocks_locked` 3, bukan 2. Tabel `process_types`; booking menyimpan **salinan** `process_extra_minutes` + `process_name` sehingga mengubah master tidak menggeser riwayat (dan menghapus master menyisakan nama lama). Endpoint ketersediaan slot ikut menerima `processTypeId` dan melaporkan `blocksRequired` dari total yang sama — tanpa itu customer melihat jam yang tidak cukup lalu ditolak saat menyimpan. **Pengecualian penting:** booking tanpa jenis proses tetap diterima bila master belum berisi satu pun jenis aktif; kalau tidak, memasang versi ini akan menghentikan semua pemesanan. Batas durasi 1–480 menit (bukan 30 seperti jenis truk, karena ini angka tambahan). Tiket supir sengaja tidak diubah. Tes: `server/test/process-type.test.ts` (15). |
