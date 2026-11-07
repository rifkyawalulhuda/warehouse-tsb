# Aturan Bisnis & Logika Inti (Business Logic Specification)

Dokumen ini mendefinisikan aturan bisnis yang telah dikonfirmasi dan bagaimana sistem mengeksekusi logika tersebut di sisi *backend*.

---

## 1. Perhitungan Durasi Dinamis Berdasarkan Jenis Truk
Durasi slot tidak dipukul rata, melainkan dihitung otomatis berdasarkan jenis kendaraan yang dipilih Customer. Sistem membagi jam operasional gudang ke dalam **Satuan Unit Waktu (Time Unit)** per **30 menit**.

### Tabel Standar Durasi Armada (Dapat Dikonfigurasi Admin):
* **Blindvan / Pickup / CDE (Engkel):** `1 Blok` = **30 Menit**
* **CDD / Fuso:** `2 Blok` = **60 Menit**
* **Wingbox / Container 20ft:** `3 Blok` = **90 Menit**
* **Container 40ft:** `4 Blok` = **120 Menit**

**Cara Kerja di Sistem:**
Jika Customer memilih **Container 40ft (120 menit)** dan memilih jam kedatangan **09:00**, maka sistem akan memeriksa apakah kuota jam pada blok `09:00-09:30`, `09:30-10:00`, `10:00-10:30`, dan `10:30-11:00` semuanya masih memiliki sisa kuota $\ge 1$. Jika salah satu blok di tengah sudah penuh, maka jam `09:00` tidak dapat dipilih untuk ukuran truk tersebut.

---

## 2. Sistem Kuota Jam (Pool Capacity) vs Alokasi Dock
Customer **tidak memilih nomor dock** saat melakukan *booking*, melainkan hanya memesan **Kuota Jam**.

* **Contoh Konfigurasi:** Gudang memiliki 4 *dock* untuk aktivitas *Unloading*. Artinya, setiap blok waktu 30 menit memiliki **Maksimal Kuota = 4 Armada**.
* **Saat Booking:** Ketika 1 Customer memesan jam `08:00 - 09:00`, sisa kuota pada rentang jam tersebut berkurang dari `4` menjadi `3`.
* **Saat Eksekusi di Gudang:** Penentuan truk masuk ke `Dock 1`, `Dock 2`, `Dock 3`, atau `Dock 4` dilakukan oleh **Admin Gudang** pada saat truk sudah melewati pos Security (*Checked-In*). Hal ini mencegah kemacetan apabila ada satu *dock* yang sedang mengalami kendala teknis atau keterlambatan bongkar muat.

---

## 3. Kebijakan Auto-Approved & Pengisian Data Kendaraan Menyusul
1. **Auto-Approved:** Selama kuota jam masih tersedia, setiap pemesanan yang disubmit oleh Customer langsung berstatus disetujui dan langsung memotong sisa kuota tanpa perlu persetujuan Admin.
2. **Opsi Kosongkan Data Supir & Plat Nomor:**
   * Saat membuat *booking*, kolom `Plat Nomor`, `Nama Supir`, dan `No. WA Supir` bersifat **Opsional**.
   * Jika dikosongkan, status pemesanan menjadi **`BOOKED_INCOMPLETE`**. Kuota jam sudah aman terkunci, namun **QR Code belum ditampilkan** (digantikan dengan pesan peringatan *"Lengkapi data Plat Nomor & Supir untuk mengaktifkan QR Code"*).
   * Begitu Customer (atau Supir melalui halaman tautan tiket) menginput Plat Nomor dan Nama Supir, status otomatis berubah menjadi **`BOOKED_READY`** dan **QR Code langsung muncul**.

---

## 4. Penanganan Keterlambatan (Grace Period & Late Waiting List)
Admin menetapkan batas toleransi keterlambatan (*Grace Period*), misalnya **15 menit** dari jadwal mulai.

### Logika Validasi Saat Scan QR di Gate-In (Pos Security):
Misalkan jadwal *booking* sebuah truk adalah pukul **09:00**, dengan batas toleransi **15 menit** (maksimal pukul **09:15**):

1. **Datang Terlalu Cepat (Misal < 08:30):**
   * Sistem memberi notifikasi ke Security bahwa truk datang lebih awal, namun tetap mengizinkan *Check-In* untuk parkir di area tunggu (*Staging*) dengan status **`CHECKED_IN_ON_TIME`**.
2. **Datang Tepat Waktu (08:30 s/d 09:15):**
   * Layar Security berwarna **Hijau**. Status berubah menjadi **`CHECKED_IN_ON_TIME`** dan masuk ke daftar antrean prioritas utama di layar Admin.
3. **Datang Terlambat (> 09:15):**
   * QR Code **tidak hangus** dan tetap bisa dipindai.
   * Layar Security berwarna **Kuning/Oranye** dengan keterangan jumlah menit keterlambatan.
   * Status otomatis berubah menjadi **`LATE_WAITING_LIST`**.
   * Di Dashboard Admin, truk ini dipisahkan ke kolom **"Antrean Terlambat"** agar tidak mengambil hak *dock* milik truk jam berikutnya yang datang tepat waktu. Admin dapat memasukkan truk dari daftar *Late Waiting List* kapan saja ketika ada *dock* yang luang atau selesai lebih cepat.

---

## 5. Siklus Status Pemesanan (State Machine)

| Kode Status | Keterangan | Pemicu Perubahan (Trigger) |
| :--- | :--- | :--- |
| `BOOKED_INCOMPLETE` | Jadwal terkunci, data Plat/Supir masih kosong, QR nonaktif. | Customer submit form tanpa data kendaraan. |
| `BOOKED_READY` | Data lengkap, QR Code aktif dan siap di-scan. | Customer mengisi data kendaraan saat awal atau menyusul. |
| `CHECKED_IN_ON_TIME` | Truk tiba di gudang tepat waktu, menunggu di parkiran. | Scan QR oleh Security di Gate-In ($\le$ batas toleransi). |
| `LATE_WAITING_LIST` | Truk tiba terlambat, masuk daftar tunggu cadangan. | Scan QR oleh Security di Gate-In ($>$ batas toleransi). |
| `DOCK_ASSIGNED` | Nomor *dock* sudah ditunjuk, truk dipanggil merapat. | Admin klik tombol *Assign Dock* di Dashboard. |
| `IN_PROGRESS` | Proses *loading/unloading* sedang berjalan di *dock*. | Scan QR / Klik *Start* oleh Checker di area *dock*. |
| `COMPLETED` | Proses barang selesai, *dock* kembali kosong, truk siap keluar. | Scan QR / Klik *Finish* oleh Checker di area *dock*. |
| `CHECKED_OUT` | Truk sudah keluar dari gerbang gudang. Sesi selesai. | Scan QR oleh Security di Gate-Out. |
| `CANCELLED` | Pemesanan dibatalkan, kuota jam dikembalikan ke sistem. | Customer/Admin membatalkan jadwal sebelum truk tiba. |
| `NO_SHOW` | Truk tidak datang hingga hari operasional berakhir. | *Cron job* otomatis di akhir hari kerja. |