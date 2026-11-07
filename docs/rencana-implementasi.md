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
| Cakupan | Full-stack end-to-end, satu gudang (v1) | Tidak ada `warehouse_id`; selector gudang di UI dibuang |
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
| `users` | Tambah `acting_role` tidak perlu; role tetap satu |
| `warehouse_settings` | Hapus `max_loading_quota_per_slot`, `max_unloading_quota_per_slot`; tambah `early_arrival_limit_minutes`, `booking_window_days` |
| `truck_types` | Tetap (`duration_minutes`, `blocks_required`) |
| `docks` | Tetap; `current_status` tetap untuk tampilan cepat, sumber kebenaran tetap `bookings.status` |
| `bookings` | Tetap |
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
| `npm run test:api` | 52 tes lolos (8 berkas), termasuk konkurensi dua koneksi, kuota, auth, realtime, no-show |
| `npm test` (Vitest browser) | 64 tes lolos |
| Alur manual di browser | login 4 peran, booking, tiket, scan, dock, dashboard, laporan |
| `PUT /api/settings` tanpa `requireAuth` | diperbaiki; tes regresi di `server/test/settings.test.ts` (200 admin, 403 customer, 401 tanpa sesi) |
| Realtime setelah perbaikan | `realtime.test.ts` (4 kasus): petugas menerima `booking.updated`, tamu tidak, tiket lewat `qr_token`, refresh token dipakai saat access token habis |
| NO_SHOW | dihitung terhadap akhir hari operasional, bukan `end_time` booking; tes di `no-show.test.ts` |
| Form booking untuk Admin | `/bookings/new` dibatasi ke CUSTOMER, sama dengan aturan `POST /api/bookings` |
| Nonaktifkan akun sendiri | ditolak server (`CANNOT_DEACTIVATE_SELF`, `LAST_ADMIN`); switch-nya dimatikan di UI |
| Mode terang/gelap | pemilih tema di sidebar, header, dan Pengaturan; `resolvedTheme` diperbaiki agar ikut berubah saat OS berganti tema |

