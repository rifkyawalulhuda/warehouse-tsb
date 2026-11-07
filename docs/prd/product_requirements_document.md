# Product Requirements Document (PRD)
**Nama Proyek:** Warehouse Time Slot Booking (TSB) System  
**Versi Dokumen:** 1.0 (Final Confirmed)  
**Platform:** Responsive Web Application (Desktop & Mobile Browser)

---

## 1. Latar Belakang & Tujuan Produk
Operasional penerimaan (*unloading*) dan pengiriman (*loading*) barang di gudang sering mengalami penumpukan antrean kendaraan karena kedatangan truk yang tidak terjadwal. **Warehouse Time Slot Booking (TSB)** hadir sebagai sistem penjadwalan terpusat di mana Customer wajib memesan kuota jam kedatangan terlebih dahulu dan membekali Supir Truk dengan bukti pemesanan berupa **QR Code** untuk dipindai di gerbang gudang.

### Tujuan Utama (Objectives):
1. **Eliminasi Penumpukan Truk:** Mengatur kuota kedatangan armada per jam sesuai kapasitas *dock* aktif.
2. **Fleksibilitas Ekspedisi:** Memungkinkan Customer mengunci jadwal terlebih dahulu (*Auto-Approved*) dan melengkapi identitas kendaraan/supir menyusul sebelum truk tiba.
3. **Verifikasi Cepat Berbasis QR:** Memisahkan peran dan tampilan antarmuka untuk Petugas Gate (Security) dan Petugas Checker di area *dock* melalui pemindaian QR Code berbasis web.
4. **Visibilitas & Analitik Real-time:** Memberikan pemantauan langsung kepada Admin Gudang terkait antrean *on-time*, daftar tunggu keterlambatan (*Late Waiting List*), serta pencatatan KPI durasi proses (*Turnaround Time*).

---

## 2. Daftar Peran Pengguna (User Roles & Access Matrix)

| Peran Pengguna | Perangkat Utama | Butuh Login? | Tanggung Jawab & Hak Akses Utama |
| :--- | :--- | :---: | :--- |
| **Admin Gudang** | Web Desktop | Ya | Mengatur kapasitas kuota jam & master *dock*, memantau *dashboard* harian secara *real-time*, mengalokasikan nomor *dock* untuk truk yang sudah *check-in*, mengelola *Late Waiting List*, dan mengunduh laporan KPI. |
| **Customer / Ekspedisi** | Web Desktop & Smartphone | Ya | Memesan slot kuota jam (*Loading/Unloading*), melengkapi/mengubah data Plat Nomor & Nama Supir, serta membagikan tautan tiket QR Code ke WhatsApp Supir. |
| **Supir Truk** | Web Smartphone | **Tidak** (Via URL Unik) | Membuka tautan tiket dari WhatsApp, menunjukkan QR Code di gerbang & *dock*, serta melihat status antrean dan instruksi nomor *dock* tujuan secara *real-time*. |
| **Petugas Gate (Security)** | Web Smartphone | Ya | Memindai QR Code Supir di gerbang masuk (*Gate-In*) untuk validasi jadwal (otomatis mendeteksi *On-Time* atau *Late Waiting List*) dan memindai QR saat truk keluar (*Gate-Out*). |
| **Petugas Checker (Dock)** | Web Smartphone | Ya | Memindai QR Code Supir saat truk merapat di *dock* untuk memulai perhitungan waktu (*Start Loading/Unloading*) dan menekan tombol selesai (*Finish Process*). |

---

## 3. Spesifikasi Fitur Fungsional (Functional Requirements)

### 3.1. Modul Customer (Web Desktop & Mobile)
* **Pencarian Kuota Jam Dinamis:** Menampilkan ketersediaan slot jam berdasarkan tanggal, jenis aktivitas (*Loading/Unloading*), dan jenis truk yang dipilih.
* **Booking Instan (Auto-Approved):** Pemesanan langsung mengunci kuota jam tanpa perlu menunggu persetujuan manual dari Admin.
* **Deferred Vehicle Data (Isi Data Truk Menyusul):** Customer diperbolehkan mengosongkan kolom Plat Nomor dan Nama Supir saat membuat *booking* awal, dan melengkapinya nanti sebelum keberangkatan.
* **Distribusi Tiket Satu Klik:** Fitur berbagi tautan tiket langsung ke WhatsApp Supir (*Click-to-WhatsApp*) atau unduh tiket dalam format gambar/PDF.

### 3.2. Modul Tiket Supir (Mobile Web - Public Link)
* **Tampilan QR Kontras Tinggi:** Menampilkan kode QR berukuran besar yang otomatis aktif begitu data Plat Nomor & Nama Supir sudah terisi.
* **Indikator Status Real-time:** Menampilkan perubahan status secara langsung di layar HP Supir (mulai dari *Terjadwal*, *Menunggu di Parkiran*, *Masuk ke Antrean Terlambat*, hingga instruksi *Silakan Masuk ke Dock X*).

### 3.3. Modul Petugas Lapangan (Mobile Web Scanner)
* **Web Camera QR Scanner:** Pemindai QR Code langsung melalui *browser* HP tanpa instalasi aplikasi tambahan.
* **Antarmuka Khusus Security Gate:** Hanya menampilkan informasi validasi identitas armada serta tombol aksi **Gate-In** dan **Gate-Out**.
* **Antarmuka Khusus Checker Dock:** Hanya menampilkan informasi dokumen pengiriman (DO/PO/SJ), lokasi *dock*, serta tombol **Mulai Proses (Start)** dan **Selesai (Finish)**.

### 3.4. Modul Dashboard Admin Gudang (Web Desktop)
* **Live Queue & Dock Monitor:** Visualisasi seluruh *dock* aktif (Kosong vs Terisi), daftar truk yang sudah *Check-In On-Time*, dan kolom khusus **Late Waiting List**.
* **Manual Dock Assignment:** Fitur bagi Admin untuk menunjuk nomor *dock* spesifik bagi truk yang sudah berada di area parkir tunggu (*staging*).
* **Master Konfigurasi:** Pengaturan jumlah kuota/dock, jam operasional, aturan durasi per jenis armada, dan batas menit toleransi keterlambatan (*grace period*).
* **Laporan & KPI Gudang:** Rekapitulasi *On-Time Arrival Rate*, *Waiting Time*, *Processing Lead Time*, dan *Total Turnaround Time* (ekspor ke Excel/CSV).

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)
* **Kinerja & Konkurensi:** Mampu menangani 50–100 pengguna aktif secara *real-time* tanpa *double-booking* menggunakan penguncian transaksi database (*Row-Level Locking*).
* **Responsivitas UI:** Tampilan halaman Customer, Supir, Security, dan Checker dioptimalkan penuh untuk layar vertikal smartphone (*Mobile-First*), sementara halaman Admin dioptimalkan untuk layar monitor lebar (*Desktop-First*).
* **Keamanan Akses:** Koneksi wajib berjalan di atas protokol `HTTPS` (agar fitur kamera *browser* diizinkan mengakses pemindai QR) dan setiap tiket supir menggunakan *cryptographic hash token* unik yang tidak mudah ditebak.