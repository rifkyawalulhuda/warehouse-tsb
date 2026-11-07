# Panduan Deploy — Warehouse TSB

Panduan singkat memasang aplikasi di server gudang. Untuk arsitektur dan alasan desainnya, lihat
`docs/rencana-implementasi.md`.

Target: satu mesin (on-prem) menjalankan Postgres, API, dan nginx; HTTPS dari Cloudflare Tunnel.

---

## 1. Prasyarat

- Docker + Docker Compose v2
- Node.js 22 (untuk build frontend)
- Domain yang sudah diarahkan ke Cloudflare
- `cloudflared` terpasang di mesin yang sama

Spesifikasi minimum: 2 vCPU, 4 GB RAM, 40 GB SSD — cukup untuk 50–100 pengguna aktif harian.

---

## 2. Konfigurasi

```bash
cp .env.production.example .env.production
```

Isi `POSTGRES_PASSWORD`, `APP_ORIGIN`, `PUBLIC_APP_URL`, `JWT_ACCESS_SECRET`, dan
`JWT_REFRESH_SECRET`. Untuk secret:

```bash
openssl rand -base64 48
```

`APP_ORIGIN` harus sama persis dengan domain yang dibuka pengguna (termasuk `https://`), karena
dipakai untuk CORS dan cookie.

---

## 3. Build frontend

Frontend adalah berkas statis yang di-mount ke nginx, bukan bagian dari image API.

```bash
npm ci
npm run build          # menghasilkan dist/
```

Ulangi langkah ini setiap kali frontend berubah, lalu `docker compose -f docker-compose.prod.yml
restart web` (nginx membaca ulang folder yang di-mount).

---

## 4. Menjalankan stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Urutan start: `db` (menunggu healthy) → `api` (menjalankan `prisma migrate deploy` lalu server) →
`web`.

Cek:

```bash
curl http://localhost:8080/api/health
# {"data":{"status":"ok","env":"production","time":"..."}}
```

Mengisi data demo (opsional, **menghapus seluruh data yang ada**):

```bash
docker compose -f docker-compose.prod.yml exec api npx tsx server/prisma/seed.ts
```

Jangan jalankan seed di database produksi yang sudah berisi data nyata.

---

## 5. HTTPS lewat Cloudflare Tunnel

Aplikasi tidak membuka port ke internet; tunnel membuat koneksi keluar.

```bash
cloudflared tunnel login
cloudflared tunnel create warehouse-tsb
cloudflared tunnel route dns warehouse-tsb gudang.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: warehouse-tsb
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: gudang.example.com
    service: http://localhost:8080
  - service: http_status:404
```

```bash
cloudflared service install
systemctl enable --now cloudflared
```

Kamera HP untuk scan QR hanya berfungsi di `https://` (atau `localhost`). Setelah tunnel aktif,
buka `https://gudang.example.com/scan` dari HP dan izinkan akses kamera.

---

## 6. Akun awal

Seed membuat akun demo dengan password yang sama, `Rahasia123`:

| Peran | Email |
| :--- | :--- |
| Admin | `admin@tsb.test` |
| Customer | `customer@tsb.test`, `customer2@tsb.test` |
| Security | `gate@tsb.test`, `gate2@tsb.test` |
| Checker | `checker@tsb.test`, `checker2@tsb.test` |

**Ganti password semua akun sebelum dipakai sungguhan**, dan hapus akun demo yang tidak terpakai.
Admin bisa mengelola akun lewat menu **Pengguna**.

---

## 7. Operasional

| Kebutuhan | Perintah |
| :--- | :--- |
| Log API | `docker compose -f docker-compose.prod.yml logs -f api` |
| Backup database | `docker compose -f docker-compose.prod.yml exec db pg_dump -U tsb warehouse_tsb > backup-$(date +%F).sql` |
| Restore | `cat backup.sql \| docker compose -f docker-compose.prod.yml exec -T db psql -U tsb -d warehouse_tsb` |
| Update aplikasi | `git pull && npm ci && npm run build && docker compose -f docker-compose.prod.yml up -d --build` |

Migrasi database berjalan otomatis saat kontainer `api` start; tidak ada langkah manual.

Backup harian disarankan lewat cron, disimpan di luar volume Docker.

---

## 8. Tanpa Docker

API juga bisa dijalankan langsung dengan PM2:

```bash
npm ci
npm run build:api
npx prisma migrate deploy --schema server/prisma/schema.prisma
pm2 start server/dist/server.js --name warehouse-api
pm2 save
```

Sajikan `dist/` lewat nginx dengan konfigurasi setara `deploy/nginx.conf`, arahkan `/api` dan
`/socket.io` ke `http://127.0.0.1:4000`.
