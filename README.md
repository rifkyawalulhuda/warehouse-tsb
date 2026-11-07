# Warehouse TSB — Time Slot Booking Gudang

Aplikasi penjadwalan truk masuk gudang: customer memesan slot bongkar/muat, supir menerima tiket
QR, petugas gerbang mencatat kedatangan, checker mengelola dock, dan admin memantau semuanya
secara real-time.

Dibangun dari enam dokumen di `docs/prd/`. Keputusan desain dan koreksi terhadap PRD dicatat di
`docs/rencana-implementasi.md`; panduan produksi di `docs/deploy.md`.

---

## Menjalankan di lokal

Butuh Node.js 22+ dan Docker.

```bash
# 1. Database
docker compose up -d

# 2. Konfigurasi
cp .env.example .env

# 3. Dependensi + skema + data demo
npm install
npm run db:migrate
npm run db:seed

# 4. Frontend (5173) + API (4000) sekaligus
npm run dev
```

Buka <http://localhost:5173>.

### Akun demo

Password semuanya `Rahasia123`.

| Peran | Email | Halaman awal |
| :--- | :--- | :--- |
| Admin | `admin@tsb.test` | `/dashboard` |
| Customer | `customer@tsb.test` | `/bookings` |
| Security | `gate@tsb.test` | `/scan` |
| Checker | `checker@tsb.test` | `/dock` |

Seed mengisi satu hari operasional penuh: booking di semua status, antrean terlambat, dan riwayat
aktivitas — supaya dashboard tidak kosong saat pertama dibuka.

---

## Perintah

| Perintah | Kegunaan |
| :--- | :--- |
| `npm run dev` | Frontend + API bersamaan |
| `npm run dev:web` | Vite saja |
| `npm run dev:api` | API saja (`tsx watch`) |
| `npm run build` | Typecheck + build frontend ke `dist/` |
| `npm run build:api` | Compile API ke `server/dist/` |
| `npm run db:migrate` | Migrasi Prisma |
| `npm run db:seed` | Isi ulang data demo (menghapus data lama) |
| `npm run db:studio` | Prisma Studio |
| `npm run test:api` | Tes API (Vitest, Node, Postgres sungguhan) |
| `npm test` | Tes frontend (Vitest browser, Chrome sistem) |
| `npm run lint` | ESLint |

Tes API memakai database terpisah bernama `<nama>_test`; data dev tidak tersentuh.

Tes frontend berjalan di Chrome yang terpasang di sistem. Di mesin tanpa Chrome (CI), jalankan
`npx playwright install chromium` lalu set `PLAYWRIGHT_CHANNEL=` (kosong) agar memakai Chromium
bawaan Playwright.

---

## Struktur

```
src/                    Frontend React 19 + TanStack Router/Query, Tailwind v4, shadcn/ui
  routes/               Rute: (auth), _authenticated, t/$token (tiket publik)
  features/             dashboard, bookings, ticket, scanner, dock, queue,
                        reports, master, users, settings, auth
  lib/api/              Klien axios + tipe respons
server/
  prisma/schema.prisma  8 tabel: users, warehouse_settings, truck_types, docks,
                        bookings, booking_time_logs, slot_allocations, audit_logs
  src/modules/          auth, users, settings, master, bookings, public-ticket, ops, reports
  src/lib/quota.ts      Engine kuota (murni, mudah dites)
  test/                 Tes integrasi + konkurensi
deploy/nginx.conf       Reverse proxy produksi
docker-compose.yml      Postgres untuk dev
docker-compose.prod.yml Postgres + API + nginx untuk produksi
```

---

## Cara kerja kuota

Kapasitas tidak diisi manual. Setiap slot 30 menit punya kuota sebesar **jumlah dock aktif yang
mengizinkan aktivitas tersebut** (loading / unloading / keduanya).

Booking menempati beberapa blok sesuai durasi jenis truk (CDD 60 menit = 2 blok, Tronton 90 menit =
3 blok). Saat booking dibuat, semua blok yang dibutuhkan dikunci berurutan dengan
`SELECT ... FOR UPDATE` pada tabel `slot_allocations`; bila satu blok saja penuh, seluruh transaksi
dibatalkan. Ini yang mencegah dua customer mendapat slot terakhir secara bersamaan.

Pembatalan dan `NO_SHOW` otomatis (cron 23:59 Asia/Jakarta) mengembalikan kuota ke blok semula.

---

## Alur status booking

```
BOOKED_INCOMPLETE ──lengkapi data──► BOOKED_READY
        │                                  │
        │                                  ├─ gate-in tepat waktu ─► CHECKED_IN_ON_TIME
        │                                  └─ gate-in terlambat  ─► LATE_WAITING_LIST
        │                                                              │
        ├─ batal ─► CANCELLED                                          ▼
        └─ tidak datang ─► NO_SHOW ────────────────► DOCK_ASSIGNED ─► IN_PROGRESS ─► COMPLETED ─► CHECKED_OUT
```

Gate-in ditolak bila truk datang lebih awal dari `early_arrival_limit_minutes` (default 60) sebelum
jadwalnya, supaya parkiran staging tidak menumpuk.

---

## Realtime

Socket.io mengirim `booking.updated`, `dock.updated`, dan `queue.updated` ke room `admin`,
`dock:<id>`, dan `booking:<id>`. Halaman tiket supir bergabung lewat `qr_token` tanpa login,
sehingga nomor dock dan status berubah di HP supir tanpa refresh.

---

## Lisensi

Lihat `LICENSE`.
