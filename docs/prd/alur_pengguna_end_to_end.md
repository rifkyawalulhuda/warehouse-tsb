# Alur Pengguna End-to-End (Detailed User Flows)

Dokumen ini menguraikan urutan interaksi antar pengguna secara kronologis dari pemesanan hingga truk meninggalkan gudang.

---

## Alur 1: Pemesanan Slot & Pengiriman Tiket (Customer -> Supir)

1. **Akses Aplikasi:** Staff Customer membuka Web App (via PC atau HP) dan melakukan login.
2. **Pilih Kebutuhan:**
   * Pilih Tanggal Kedatangan.
   * Pilih Aktivitas: `LOADING (Muat)` atau `UNLOADING (Bongkar)`.
   * Pilih Jenis Truk: (misal `Wingbox - Durasi Otomatis 90 Menit`).
3. **Pilih Jam Kedatangan:**
   * Sistem menampilkan daftar jam operasional beserta indikator sisa kuota yang mampu menampung durasi 90 menit berturut-turut.
   * Customer memilih jam `10:00` (otomatis mengunci slot `10:00 - 11:30`).
4. **Input Dokumen & Kendaraan:**
   * Customer mengisi Nomor Referensi Dokumen (PO/DO/Surat Jalan).
   * *Cabang Kondisi A (Data Supir Sudah Ada):* Customer mengisi Plat Nomor, Nama Supir, dan No. WA Supir $\rightarrow$ Status langsung `BOOKED_READY` (QR Code langsung tampil).
   * *Cabang Kondisi B (Data Supir Belum Ada):* Customer mengosongkan kolom kendaraan $\rightarrow$ Status `BOOKED_INCOMPLETE`. Saat H-2 jam keberangkatan, Customer membuka menu *Booking Saya*, mengisi Plat Nomor & Nama Supir $\rightarrow$ Status berubah menjadi `BOOKED_READY`.
5. **Kirim Tiket ke Supir:**
   * Customer menekan tombol **"Kirim Tiket via WhatsApp"**.
   * Supir menerima pesan WhatsApp berisi ringkasan jadwal dan tautan langsung: `https://tsb.gudang.com/t/8f92a1b...`

---

## Alur 2: Kedatangan Truk di Pos Security (Supir & Petugas Gate)

1. **Persiapan Supir di Gerbang:**
   * Supir tiba di gerbang gudang, mengklik tautan di WhatsApp dari HP-nya.
   * Layar HP langsung menampilkan **QR Code** besar, Plat Nomor, dan jadwal jam booking.
2. **Pemindaian oleh Security (Gate-In):**
   * Petugas Security membuka Web App di HP khususnya (sudah login sebagai `GATE_OFFICER`), lalu menekan tombol **Scan QR Gate**.
   * Kamera HP Security memindai layar HP Supir.
3. **Verifikasi Identitas & Waktu:**
   * Layar HP Security menampilkan Nama Perusahaan, Plat Nomor, dan Nama Supir. Security mencocokkan fisik plat nomor truk dengan yang tertera di layar, lalu menekan tombol **Konfirmasi Gate-In**.
   * **Jika Tepat Waktu:** Sistem memberi status `CHECKED_IN_ON_TIME`. Security mengarahkan supir ke area parkir tunggu (*Staging Area*).
   * **Jika Terlambat:** Sistem memberi peringatan warna Oranye dan status otomatis menjadi `LATE_WAITING_LIST`. Security memberi tahu supir bahwa karena terlambat, truk masuk ke antrean cadangan di parkiran tunggu.

---

## Alur 3: Penugasan Dock oleh Admin Gudang (Admin -> Supir & Checker)

1. **Pemantauan Dashboard:**
   * Di layar monitor ruang kantor, Dashboard Admin menampilkan bunyi notifikasi singkat dan memperbarui tabel antrean truk yang baru saja *Check-In* di gerbang.
2. **Keputusan Alokasi Dock:**
   * Admin melihat panel **Status Dock Real-time** (misal: `Dock 1: Terisi [Sisa 15 mnt]`, `Dock 2: KOSONG`, `Dock 3: Terisi`).
   * Admin memilih truk dari daftar `CHECKED_IN_ON_TIME` (atau dari kolom `LATE_WAITING_LIST` jika jadwal normal sedang senggang), lalu memilih **`Assign ke Dock 2`**.
3. **Notifikasi Real-time ke Lapangan:**
   * Detik itu juga (melalui koneksi *WebSocket*), layar tiket di HP Supir berubah warna menjadi **Biru Terang** dengan instruksi besar: **"SILAKAN MERAPAT KE DOCK 2"**.
   * Di saat bersamaan, layar HP Petugas Checker yang berjaga di `Dock 2` menampilkan informasi truk yang akan segera merapat ke *dock*-nya.

---

## Alur 4: Proses Bongkar/Muat di Area Dock (Supir & Petugas Checker)

1. **Truk Merapat ke Dock:**
   * Supir memundurkan truk ke `Dock 2`.
2. **Mulai Pengerjaan (Start Process):**
   * Petugas Checker membuka Web App di HP-nya (login sebagai `CHECKER`), memindai QR Code Supir (atau mengklik data truk di daftar `Dock 2`), lalu menekan tombol **"Mulai Bongkar/Muat"**.
   * Status berubah menjadi `IN_PROGRESS`. Waktu mulai tercatat di database dan *timer* berjalan di layar Admin.
3. **Selesai Pengerjaan (Finish Process):**
   * Setelah seluruh muatan selesai dibongkar/dimuat dan dokumen fisik selesai diperiksa, Checker menekan tombol **"Selesai Proses"** di HP-nya.
   * Status truk berubah menjadi `COMPLETED`.
   * Status `Dock 2` di layar Admin otomatis berubah kembali menjadi **`KOSONG (Available)`** dan siap diberikan ke truk berikutnya.

---

## Alur 5: Truk Meninggalkan Gudang (Supir & Petugas Gate)

1. **Menuju Gerbang Keluar:**
   * Layar HP Supir menampilkan status: **"PROSES SELESAI - SILAKAN MENUJU GERBANG KELUAR"**.
2. **Pemindaian Terakhir (Gate-Out):**
   * Di pos keluar, Petugas Security memindai ulang QR Code Supir dan menekan tombol **"Konfirmasi Gate-Out"**.
   * Status berubah menjadi `CHECKED_OUT`.
3. **Pencatatan Selesai:**
   * Tiket QR Code dinyatakan selesai/ditutup dan seluruh *log* durasi tersimpan ke laporan analitik Admin.