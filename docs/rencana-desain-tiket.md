# Rencana Implementasi: Desain Tiket

Dokumen kerja untuk **pilihan tata letak kartu tiket supir**, hasil sesi grilling dengan pemilik
produk. Isinya mengunci keputusan, bentuk data, dan aturan yang menjaga tiket tetap sama di tiga
tempat ia muncul: layar, cetak, dan PNG unduhan.

---

## 1. Keputusan yang dikunci

| # | Topik | Keputusan |
| :--- | :--- | :--- |
| 1 | Siapa yang memilih | **Admin**, di Pengaturan. Bukan per gudang, bukan per booking |
| 2 | Letak pemilih | Tab baru **Desain tiket** di grup **Preferensi** |
| 3 | Jumlah desain | Delapan, dikelompokkan: tiga tampilan standar + lima untuk kondisi tertentu |
| 4 | Desain bawaan | `CLASSIC` — gudang yang tidak menyentuh Pengaturan tidak melihat perubahan apa pun |
| 5 | Ukuran | Semua desain **360 × 482**; PNG 720 × 964 (skala 2) |
| 6 | Isi | Delapan nilai yang sama di semua desain; tidak ada data yang hilang karena ganti desain |
| 7 | QR | Minimal 120 px di semua desain; diletakkan di atas alas putih, termasuk pada kartu gelap |
| 8 | Penyimpanan | Enum `TicketDesign` di `warehouse_settings.ticket_design` |
| 9 | Pengiriman | Lewat `GET /api/branding` (publik) karena halaman tiket supir tidak punya sesi |
| 10 | Cakupan | Berlaku untuk **semua** tiket, termasuk tautan lama yang dibuka ulang |
| 11 | Pratinjau | Kartu contoh besar di Pengaturan, memakai komponen `TicketCard` yang sebenarnya |
| 12 | Logo | Tampil di semua desain, tetapi hanya dari origin sendiri atau `data:image/` |
| 13 | Label `E-TIKET` | `#64748B` (4,7:1), bukan `#94A3B8` (2,6:1) yang gagal ambang teks kecil |
| 14 | Pita desain `NAVY` | Tetap `#1F3A5F`, tidak mengikuti warna merek halaman masuk |

---

## 2. Delapan desain

Dikelompokkan menurut **kondisi pemakaian**, bukan selera visual. Itu sebabnya label pemilih
menyebut keadaan ("aman difotokopi", "saat QR gagal dipindai"), supaya Admin memilih karena
kebutuhan.

### Tampilan standar

| Enum | Nama | Untuk |
| :--- | :--- | :--- |
| `CLASSIC` | Klasik Biru | Bawaan; pita biru, kartu putih, paling dikenal petugas |
| `MINIMAL` | Minimal | Sedikit tinta, banyak ruang kosong; QR di samping teks |
| `NAVY` | Navy Resmi | Pita navy penuh, terlihat formal di serah-terima |

### Untuk kondisi tertentu

| Enum | Nama | Menutup celah |
| :--- | :--- | :--- |
| `THERMAL` | Termal Mono | Printer thermal 58/80 mm dan fotokopi pudar: tanpa warna, hierarki lewat ketebalan huruf, kontras 21:1 |
| `LARGE_CODE` | Kode Besar | QR gagal dipindai (kamera kotor, layar retak): rel aksen di kiri, kode booking 30 px monospace |
| `NIGHT` | Malam | Dibuka di gerbang malam: kartu gelap, QR tetap di alas putih karena QR terbalik sulit dipindai |
| `TEAROFF` | Pita Sobek | Tiket disobek petugas: stub bawah berisi kode, tanggal, plat, nama supir |
| `BRAND` | Warna Merek | Identitas gudang: pita atas mengikuti warna halaman masuk |

---

## 3. Satu sumber warna

`src/features/ticket/ticket-design.ts` memegang **semua** hex tiket:

- `TICKET_PALETTE` — satu-satunya tempat nilai warna ditulis.
- `ticketCssVars()` memasangnya ke DOM sebagai custom property `--tk-*`.
- `ticket-image.ts` membaca objek yang sama, bukan hex sendiri.

Tidak ada hex di `ticket-card.tsx`. Alasannya bukan kerapian: kalau DOM dan kanvas punya salinan
masing-masing, satu digit yang melenceng menghasilkan tiket layar dan tiket unduhan yang berbeda
warna, dan tidak ada tes yang menangkapnya.

Warna isian bebas (dari Pengaturan) melewati penjaga di berkas yang sama:

| Fungsi | Tugas |
| :--- | :--- |
| `readableOn(bg)` | Memilih hitam atau putih untuk teks di atas warna apa pun |
| `accentOnWhite(hex)` | Menggelapkan aksen sampai lolos 4,5:1 di atas putih |
| `ticketBandColor(brand)` | Warna pita desain `BRAND`, jatuh ke navy bila kosong/bukan hex |

Tanpa `accentOnWhite`, kuning terang dari halaman masuk akan membuat teks putih di atasnya tak
terbaca — dan Admin tidak punya cara tahu sampai tiket dicetak.

---

## 4. Angka yang harus bergerak berpasangan

Kartu dipatok, bukan mengalir bebas, karena kanvas menggambar ulang dengan ukuran yang sama.
Angka di `ticket-card.tsx` (DOM) dan `ticket-image.ts` (kanvas) harus diubah **bersamaan**.

| Hal | Nilai |
| :--- | :--- |
| `TICKET_WIDTH` / `TICKET_HEIGHT` | 360 / 482 |
| PNG | 720 × 964 (`scale = 2`) |
| `step` baris field | 34 di semua desain |
| `valueOffset` | 12 untuk `CLASSIC`, 13 untuk tujuh lainnya |
| `top` baris pertama | CLASSIC 314, MINIMAL 254, NAVY 316, THERMAL 301, LARGE_CODE 309, NIGHT 318, TEAROFF 274, BRAND 308 |
| Ukuran QR | CLASSIC 162, MINIMAL 132, NAVY/THERMAL/LARGE_CODE/NIGHT/BRAND 150, TEAROFF 140 |

Angka `top` diturunkan dari pusat teks DOM ditambah 4 px, lalu dikunci tes dengan toleransi 3 px.
`valueOffset` sempat 17 di semua desain — nilai field turun 5 px lebih jauh daripada labelnya
dibanding DOM, dan itu cacat lama yang baru ketahuan saat PNG dibandingkan berdampingan.

---

## 5. Tiga tempat yang harus sama

| Tempat | Berkas | Yang mudah rusak |
| :--- | :--- | :--- |
| Layar | `ticket-card.tsx` | Teks membungkus dan terpotong tinggi tetap |
| PNG | `ticket-image.ts` | Baris meleset, teks terpotong karena `fit()` diukur sebelum `applyStyle()` |
| Cetak | `ticket-print.css` | Chrome membuang warna latar; kartu `NIGHT` jadi teks putih di kertas putih |

`[data-ticket-card]` **wajib** mempertahankan `print-color-adjust: exact` (+ `-webkit-`). Tanpa itu
desain `NIGHT` tercetak kosong, dan tidak ada tes otomatis yang bisa menangkapnya karena tes tidak
membuka dialog cetak.

---

## 6. Logo

`safeLogoUrl()` di `src/features/ticket/logo.ts` hanya menerima `data:image/` dan URL di origin
aplikasi (`/api/uploads/...`), dipakai **bersama** oleh DOM dan kanvas.

Alasan sebenarnya bukan noda kanvas: `crossOrigin = 'anonymous'` membuat gambar non-CORS gagal
dimuat, jadi kanvas tidak pernah ternoda. Cacatnya lebih halus — `<img>` di layar tidak memakai
`crossOrigin`, sehingga logo domain lain **tampil di layar tetapi hilang dari PNG**. Tanpa aturan
bersama, tiket di layar berlogo dan tiket unduhan tidak.

---

## 7. Tes penjaga

| Tes | Menjaga |
| :--- | :--- |
| `ticket-size.test.tsx` | Tinggi kartu DOM = `TICKET_HEIGHT` (selisih ≤2 px) di semua desain |
| `ticket-layout.test.tsx` | Setiap baris teks DOM bertinta di kanvas pada ketinggian yang sama (toleransi 3 px) |
| `ticket-image.test.ts` | PNG terbentuk untuk setiap desain; ukuran dan warna latar benar |
| `ticket-card.test.tsx` | Isi kartu, stub `TEAROFF`, dan aturan logo |
| `ticket-design-picker.test.tsx` | Delapan radio, dua kelompok, pratinjau ikut pilihan dan warna merek |
| `logo.test.ts` | Hanya origin sendiri dan `data:image/` yang lolos |
| `settings.test.ts` | `PATCH` menyimpan desain, nilai asing ditolak 400, `/api/branding` ikut mengirim |
| `form.test.ts` | Seksi desain tidak pernah menghalangi penyimpanan |

`ticket-size` dan `ticket-layout` memutar `TICKET_DESIGNS`, jadi desain kesembilan otomatis ikut
diuji tanpa menyentuh tesnya.

**Jebakan yang pernah terjadi:** `ticket-layout` versi pertama menandai "piksel terang = tinta"
untuk kartu gelap. Akibatnya badan putih `NAVY` dan `BRAND` dianggap bertinta di seluruh baris,
setiap baris DOM lulus tanpa diperiksa, dan tesnya hijau tapi kosong. Versi sekarang mengukur tinta
sebagai **kontras terhadap luminans dominan tiap baris** (selisih >60).

---

## 8. Yang sengaja tidak dilakukan

- **Warna merek mengikuti pita `NAVY`.** Pemilik produk memilih navy tetap; `BRAND` yang melayani
  identitas warna.
- **Logo dari URL luar.** Ditolak di kedua sisi, lihat bagian 6.
- **Ukuran kartu yang mengikuti lebar layar.** Pratinjau dipatok 360 px dan boleh digeser mendatar;
  kartu yang menyusut akan membungkus teks lalu terpotong oleh tinggi tetap.
- **Desain per booking.** Satu desain aktif untuk seluruh gudang; kalau per booking, petugas gate
  harus mengenali delapan bentuk sekaligus di antrean.

---

## 9. Catatan operasional

- Migrasi `20261124140000_add_ticket_design_presets` memakai `ALTER TYPE ... ADD VALUE IF NOT EXISTS`
  yang hanya sah di dalam transaksi pada Postgres 12+. Kedua berkas compose memakai
  `postgres:16-alpine`, jadi batas ini tidak berlaku di proyek ini.
- Menambah desain baru berarti: satu nilai enum (Prisma + Zod + tipe klien), satu cabang gambar di
  `ticket-image.ts`, satu cabang DOM di `ticket-card.tsx`, dua kunci terjemahan, dan satu entri
  `TICKET_DESIGN_GROUP`. Tes lama langsung ikut menguji.
