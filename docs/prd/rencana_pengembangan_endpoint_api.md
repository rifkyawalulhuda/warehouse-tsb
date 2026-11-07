# Rencana Pengembangan (Development Plan) & Spesifikasi API

Dokumen ini berisi tahapan pengerjaan proyek (*roadmap*) dari awal hingga siap digunakan di gudang, beserta daftar *endpoint* API yang perlu dibangun.

---

## 1. Daftar Endpoint REST API (Backend Specification)

### A. Autentikasi & Konfigurasi Master
* `POST /api/auth/login` — Login untuk Admin, Customer, Security, dan Checker.
* `GET /api/settings` — Mengambil konfigurasi jam kerja, kuota, dan daftar jenis truk.
* `PUT /api/admin/settings` — Mengubah jumlah kuota per jam, *grace period*, dan jam operasional (Khusus Admin).
* `GET /api/admin/docks` — Mengambil daftar seluruh *dock* beserta status terkininya.

### B. Modul Booking Customer
* `GET /api/slots/availability?date=YYYY-MM-DD&activity=UNLOADING&truckTypeId=2`
  * *Output:* Daftar jam operasional beserta status ketersediaan (Available / Full) dan sisa kuota yang sudah dihitung berdasarkan durasi jenis truk.
* `POST /api/bookings`
  * *Input:* Tanggal, jam mulai, jenis aktivitas, ID jenis truk, nomor dokumen, serta data plat/supir (opsional).
  * *Output:* Data *booking*, status (`BOOKED_INCOMPLETE` atau `BOOKED_READY`), dan `qr_token`.
* `GET /api/bookings/my-list` — Daftar riwayat dan jadwal aktif milik Customer yang sedang login.
* `PATCH /api/bookings/:id/vehicle-info` — Mengisi atau memperbarui Plat Nomor, Nama Supir, dan No. WA untuk mengaktifkan QR Code.
* `POST /api/bookings/:id/cancel` — Membatalkan jadwal dan mengembalikan kuota jam.

### C. Modul Tiket Publik Supir (Tanpa Login)
* `GET /api/public/ticket/:qr_token` — Mengambil detail tiket, status terkini, nomor *dock* tujuan, dan merender QR Code.
* `PATCH /api/public/ticket/:qr_token/vehicle-info` — *(Opsional)* Mengizinkan supir melengkapi sendiri Plat Nomornya dari halaman tiket jika belum diisi oleh admin ekspedisinya.

### D. Modul Operasional Lapangan (Security, Admin, Checker)
* `GET /api/ops/scan/:qr_token` — Membaca isi QR Code saat dipindai oleh kamera HP Security atau Checker untuk menampilkan pratinjau data truk.
* `POST /api/ops/gate-in` — *(Role: Security)* Mencatat kedatangan truk di gerbang. Backend otomatis menghitung selisih jam saat ini dengan `start_time` untuk menentukan status `CHECKED_IN_ON_TIME` atau `LATE_WAITING_LIST`.
* `POST /api/ops/assign-dock` — *(Role: Admin)* Menunjuk nomor *dock* untuk truk yang sedang menunggu, mengubah status *dock* menjadi `OCCUPIED`, dan mengirim notifikasi *real-time* ke layar Supir & Checker.
* `POST /api/ops/process-start` — *(Role: Checker)* Mencatat waktu mulai bongkar/muat (`IN_PROGRESS`).
* `POST /api/ops/process-complete` — *(Role: Checker)* Mencatat waktu selesai (`COMPLETED`) dan membebaskan status *dock* kembali menjadi `AVAILABLE`.
* `POST /api/ops/gate-out` — *(Role: Security)* Mencatat waktu keluar gerbang (`CHECKED_OUT`).

---

## 2. Tahapan Pengerjaan Proyek (Sprint Roadmap)

### Fase 1: Pondasi Database & Backend Core (Minggu 1)
1. Inisialisasi proyek Node.js (NestJS/Express) dan setup database PostgreSQL.
2. Pembuatan skema tabel (`users`, `warehouse_settings`, `truck_types`, `docks`, `bookings`, `booking_time_logs`).
3. Pembuatan sistem Autentikasi JWT dan *Role-Based Access Control* (RBAC).
4. Pembuatan algoritma perhitungan **Kuota Jam Dinamis** (berdasarkan blok 30 menit dan durasi jenis truk) beserta pengujian *Transaction Locking*.

### Fase 2: Portal Customer & Halaman Tiket QR Supir (Minggu 2)
1. Inisialisasi proyek Frontend React.js + Tailwind CSS.
2. Pembuatan halaman **Buat Booking** untuk Customer (pemilihan tanggal, jenis truk, dan jam kuota).
3. Pembuatan fitur **Update Data Kendaraan Menyusul** dan tombol **Share ke WhatsApp Supir**.
4. Pembuatan halaman **Public E-Ticket Supir** (Mobile View) lengkap dengan generator QR Code (`qrcode.react`) yang reaktif terhadap kelengkapan data plat nomor.

### Fase 3: Aplikasi Scanner Lapangan & Dashboard Admin Real-time (Minggu 3)
1. Integrasi komponen kamera pemindai QR (`html5-qrcode`) untuk halaman khusus **Petugas Gate (Security)** dan **Petugas Checker**.
2. Implementasi logika deteksi otomatis **On-Time vs Late Waiting List** saat scan Gate-In.
3. Pembuatan **Dashboard Monitoring Admin (Desktop)**:
   * Visualisasi status *Dock* (Kosong / Terisi).
   * Tabel antrean *On-Time* vs *Late Waiting List*.
   * Fitur klik *Assign Dock*.
4. Integrasi **Socket.io** agar perubahan status dari klik Admin atau scan petugas lapangan langsung memperbarui layar semua pengguna tanpa perlu me-*refresh* halaman.

### Fase 4: Laporan KPI, Pengujian Lapangan (UAT), & Deployment (Minggu 4)
1. Pembuatan halaman Laporan Analitik Admin (perhitungan otomatis *Waiting Time*, *Processing Time*, *Turnaround Time*) dan fitur *Export to Excel*.
2. Setup server produksi beserta konfigurasi domain dan sertifikat **HTTPS/SSL** (agar kamera scanner HP berjalan lancar).
3. Simulasi uji coba menyeluruh (*End-to-End Testing*) menggunakan beberapa smartphone untuk memastikan alur Customer $\rightarrow$ Supir $\rightarrow$ Security $\rightarrow$ Admin $\rightarrow$ Checker berjalan mulus.