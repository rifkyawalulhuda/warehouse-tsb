# Spesifikasi Tech Stack & Kebutuhan Infrastruktur Server

Dokumen ini merinci komponen teknologi yang digunakan beserta panduan kapasitas server untuk melayani 50–100+ pengguna aktif secara *real-time*.

---

## 1. Daftar Tech Stack & Pustaka (Libraries)

### A. Frontend (Web Desktop & Mobile Browser)
* **Core Framework:** React.js (menggunakan Vite untuk *build tool* yang cepat dan ringan).
* **Styling & UI:** Tailwind CSS + Shadcn UI / Ant Design (memudahkan pembuatan tabel *dashboard* Admin di desktop sekaligus tampilan tombol besar untuk layar sentuh HP Supir & Petugas).
* **State & Data Fetching:** TanStack React Query (untuk sinkronisasi data API) + Socket.io-client (untuk menerima *update* status antrean secara *real-time*).
* **Generator QR Code (Sisi Tiket Supir):** `qrcode.react` (merender QR Code tajam berformat SVG/Canvas langsung di *browser* HP tanpa membebani penyimpanan server).
* **Scanner QR Code (Sisi HP Security & Checker):** `html5-qrcode` (mengakses kamera belakang smartphone langsung dari *browser* Chrome/Safari).

### B. Backend & API
* **Runtime & Framework:** Node.js (LTS) dengan **NestJS** atau **Express.js** (menggunakan TypeScript agar tipe data dan status *booking* terjaga ketat).
* **ORM & Database Client:** Prisma ORM atau TypeORM (dilengkapi fitur *Connection Pooling* dan *Interactive Transactions*).
* **Real-time Engine:** `Socket.io` (mengirimkan sinyal instan ke *room* khusus Admin, Checker, dan halaman tiket Supir saat ada perubahan status).
* **Authentication:** JSON Web Token (JWT) dengan `bcrypt` untuk akun Admin, Customer, Security, dan Checker.
* **Export Laporan:** `exceljs` (untuk mengunduh laporan histori & KPI ke format `.xlsx`).

### C. Database
* **RDBMS:** PostgreSQL (Versi 15 atau 16).

---

## 2. Spesifikasi Kebutuhan Server (Hardware Sizing)

Untuk menangani **50–100 pengguna aktif harian secara *real-time***, berikut adalah spesifikasi server yang direkomendasikan:

| Komponen | Spesifikasi Minimum | Spesifikasi Rekomendasi (Production) |
| :--- | :--- | :--- |
| **Processor (CPU)** | 2 Cores / 2 vCPU | **4 Cores / 4 vCPU** |
| **Memory (RAM)** | 4 GB | **8 GB** (atau 16 GB jika menggunakan PC Server Lokal) |
| **Penyimpanan (Storage)** | 40 GB SSD | **80–120 GB NVMe SSD** |
| **Koneksi Jaringan** | 10 Mbps | **50+ Mbps Stabil** |
| **Sistem Operasi** | Ubuntu Server 22.04 / 24.04 LTS | Ubuntu Server 24.04 LTS (atau Windows + Docker/PM2) |

### Alokasi Beban Kerja di Server:
1. **PostgreSQL:** Mengonsumsi ~500 MB – 1.5 GB RAM. Pertumbuhan ukuran data teks untuk 100 truk/hari sangat kecil (hanya sekitar **50–100 MB per tahun**).
2. **Node.js Backend:** Mengonsumsi ~150 MB – 300 MB RAM. Dijalankan menggunakan **PM2 Process Manager** agar aplikasi otomatis menyala kembali jika server mengalami *restart*.
3. **File Statis React:** Di-*serve* langsung oleh Nginx/Cloudflare dengan *caching*, sehingga hampir tidak memakan CPU server.

---

## 3. Syarat Wajib Deployment (SSL / HTTPS)
Karena Petugas Security dan Checker akan melakukan **Scan QR menggunakan kamera HP via browser**, aplikasi **WAJIB** diakses menggunakan protokol **`https://`**.
* Kebijakan keamanan semua *browser* modern (Chrome di Android dan Safari di iOS) akan **memblokir akses kamera (`navigator.mediaDevices.getUserMedia`)** jika website masih menggunakan `http://` biasa (kecuali `localhost`).
* **Solusi:** Gunakan sertifikat SSL gratis dari **Let's Encrypt (Certbot)** jika menggunakan Cloud VPS, atau gunakan **Cloudflare Tunnel** jika server ditaruh secara lokal (*on-premise*) di kantor/gudang Anda.