# Rencana: Pengaturan Akun

Halaman `/account` — satu-satunya tempat setiap peran mengubah datanya sendiri.
Dokumen ini mencatat keputusan yang dikunci lewat sesi grilling, alasan di balik
tiap batasan, dan cara memverifikasinya.

Sumber kebutuhan: permintaan "buatkan fitur Pengaturan Akun seperti umumnya",
lalu enam keputusan yang dipilih pemilik produk.

---

## 1. Masalah yang diselesaikan

Menu **Pengaturan Akun** di dropdown pengguna mengarah ke `/settings`, halaman
pengaturan **gudang** yang dijaga `RequireAuth roles={['ADMIN']}`. Dua akibatnya:

- Untuk Gate, Checker, dan Customer, tautan itu berakhir di 403 — menu yang
  tampak tersedia tetapi tidak bisa dibuka.
- Untuk Admin, ia membuka halaman yang bukan pengaturan akun, sehingga tidak ada
  jalan sama sekali untuk mengganti kata sandi sendiri.

Jadi fiturnya memang belum ada, bukan sekadar belum berfungsi.

---

## 2. Keputusan yang dikunci

| Topik | Keputusan | Alasan |
| :--- | :--- | :--- |
| Rute | Baru: `/account`, semua peran | Satu tautan tidak boleh berarti dua halaman berbeda menurut peran |
| Isi | Profil, email, kata sandi, perangkat & sesi | Empat hal yang benar-benar milik pengguna |
| Email | Boleh diubah sendiri, wajib ulang + kata sandi | Tanpa verifikasi email, salah ketik mengunci akun secara permanen |
| Setelah kata sandi diganti | Sesi lain dicabut, sesi ini tetap | Perangkat yang mungkin sudah dicuri putus; perangkat yang sedang dipakai tidak terlempar |
| Daftar perangkat | Hanya jumlah + tombol | `refresh_sessions` tidak menyimpan user-agent |
| Hapus akun | Tidak ada; arahkan ke Admin | Booking menyimpan `created_by`; akun adalah aset organisasi |
| Bahasa & tema | **Tidak** dimasukkan | Keduanya sudah ada di header dan disimpan per perangkat |

Bahasa dan tema sengaja ditolak meskipun "pengaturan akun pada umumnya"
memuatnya: keduanya preferensi per perangkat (localStorage), bukan per akun.
Menaruhnya lagi di halaman ini menciptakan dua sumber kebenaran untuk satu nilai.

---

## 3. Yang tidak mungkin hari ini

| Fitur umum | Sebab |
| :--- | :--- |
| Verifikasi email | Tidak ada layanan email di `server/` (tidak ada SMTP, tidak ada pustaka pengirim) |
| "Lupa kata sandi" lewat tautan | Sama: butuh pengirim email |
| Notifikasi "email Anda diubah" | Sama |
| Daftar perangkat dengan nama | Tabel sesi tidak punya kolom user-agent |

Karena itu email dijaga dengan cara lain: diketik dua kali **dan** disertai kata
sandi saat ini. Bukan formalitas — tanpa verifikasi ulang, cookie sesi yang
dicuri cukup untuk mengalihkan identitas masuk ke alamat penyerang, dan pemilik
akun kehilangan aksesnya tanpa tahu sebabnya.

---

## 4. Server

Modul: `server/src/modules/account/routes.ts`. Seluruh router memakai
`requireAuth`; **tidak ada parameter id pengguna di jalur mana pun** — id selalu
diambil dari sesi, sehingga tidak ada celah mengedit akun orang lain dengan
menebak id.

| Metode | Jalur | Keterangan |
| :--- | :--- | :--- |
| `GET` | `/api/account` | Profil + jumlah sesi aktif |
| `PATCH` | `/api/account/profile` | Nama, nomor HP |
| `PATCH` | `/api/account/email` | Email + kata sandi saat ini |
| `PATCH` | `/api/account/password` | Sandi lama, sandi baru |
| `POST` | `/api/account/sessions/revoke-others` | Cabut semua kecuali sesi ini |

`PATCH /email` dan `PATCH /password` memakai `accountLimiter` karena keduanya
memverifikasi kata sandi dan bisa dipakai menebak sandi berulang kali.

`GET /auth/me` kini ikut mengirim `phone`. Sebelumnya `publicUser()` tidak
memilih kolom itu, sehingga form profil tidak bisa terisi tanpa mengubah
endpoint ini.

### Tiga kode galat yang mudah salah

| Kode | Status | Kenapa bukan yang lain |
| :--- | :--- | :--- |
| `INVALID_PASSWORD` | 400 | **Bukan 401**: klien memperlakukan 401 sebagai "sesi berakhir", mencoba refresh, lalu melempar pengguna ke halaman masuk — orang yang salah mengetik sandi akan terlempar keluar dari akunnya sendiri |
| `EMAIL_TAKEN` | 409 | Bukan 400: bukan kesalahan format, melainkan bentrok dengan data yang ada |
| `EMAIL_UNCHANGED` / `PASSWORD_UNCHANGED` | 400 | Tanpa ini, "ganti" bisa berhasil tanpa mengubah apa pun dan pengguna mengira akunnya sudah diperbarui |

### `revokeOtherSessions`

Fungsi baru di `server/src/modules/auth/sessions.ts`. `revokeUserSessions` yang
sudah ada tidak cocok dipakai di sini: ia mencabut sesi yang sedang aktif juga,
sehingga orang yang baru memperkuat akunnya justru terlempar keluar di perangkat
yang ia pegang.

`keepSessionId` adalah `sid` dari cookie refresh — id baris `refresh_sessions`,
bukan id pengguna. Bila cookie tidak ada atau rusak, semua sesi dicabut: tidak
ada sesi yang bisa disebut "yang sedang dipakai".

Kata sandi di-hash dengan bcrypt sebelum disimpan, dan `newPassword` dibatasi 72
bita (batas bcrypt). Menolak yang lebih panjang lebih jujur daripada menerima
lalu memotongnya diam-diam.

Audit log mencatat tiga aksi: `ACCOUNT_EMAIL_CHANGED` (dari → ke),
`ACCOUNT_PASSWORD_CHANGED` (jumlah sesi dicabut), dan `ACCOUNT_SESSIONS_REVOKED`.
Nama dan nomor HP **tidak** dicatat, sama seperti jalur Admin di `/api/users`:
keduanya sering dikoreksi dan bukan perubahan hak akses.

---

## 5. Klien

| Berkas | Isi |
| :--- | :--- |
| `src/routes/_authenticated/account.tsx` | Rute; tanpa `RequireAuth roles` |
| `src/features/account/index.tsx` | Halaman: kartu identitas + empat seksi |
| `src/features/account/profile-section.tsx` | Nama, nomor HP |
| `src/features/account/email-section.tsx` | Email sekarang (baca saja), email baru ×2, kata sandi |
| `src/features/account/password-section.tsx` | Sandi sekarang, baru ×2 |
| `src/features/account/sessions-section.tsx` | Jumlah sesi + tombol + dialog konfirmasi |
| `src/features/account/form.ts` | `profileProblem`/`emailProblem`/`passwordProblem` — fungsi murni, diuji tanpa DOM |

Setiap seksi memakai `SectionPanel` yang sudah ada (dipakai halaman Pengaturan
gudang), sehingga tombol simpan tinggal di kaki seksinya sendiri. Ini penting:
tiap seksi dikirim sebagai permintaan terpisah, jadi satu tombol di header akan
membuat orang mengira perubahan yang belum dibuka ikut tersimpan.

Email sekarang ditampilkan sebagai kolom **baca saja**. Menjadikannya kolom yang
bisa diedit membuat orang mengira ia sedang mengganti email padahal sedang
menyalinnya.

### Perilaku yang dijaga

- Spasi di ujung nama dipangkas sebelum dikirim, jadi nama tersimpan tidak
  berakhir dengan spasi.
- Perbandingan email dan kata sandi tidak peka huruf besar-kecil untuk email
  (server menyimpan huruf kecil) dan peka huruf besar-kecil untuk sandi.
- Pesan galat validasi tampil di dalam seksi (`role="alert"`), bukan toast yang
  hilang sendiri — orang perlu membacanya sambil memperbaiki isian.
- Tautan "Buka Pengaturan Gudang" hanya muncul untuk Admin; untuk peran lain ia
  hanya akan berakhir di 403.

---

## 6. Tes

| Berkas | Cakupan |
| :--- | :--- |
| `server/test/account.test.ts` | Profil tersimpan dan terpangkas, nomor HP bisa dikosongkan, email salah sandi ditolak, email bentrok 409, email tak berubah, sandi lama salah, sandi baru terlalu pendek, cabut sesi lain tanpa mengeluarkan sesi ini, `phone` muncul di `/auth/me`, 401 tanpa sesi |
| `src/features/account/form.test.ts` | Fungsi validasi murni: semua cabang, termasuk email sama beda huruf besar-kecil |
| `src/features/account/index.test.tsx` | Tombol simpan mati sampai ada perubahan; nilai terpangkas; email tak sama / email sama ditolak tanpa memanggil server; sandi tak sama ditolak; tombol "Keluarkan" mati saat hanya satu sesi; tautan Pengaturan Gudang hanya untuk Admin; nama perusahaan tampil untuk Customer |

---

## 7. Yang sengaja tidak dilakukan

| Ditolak | Sebab |
| :--- | :--- |
| Tab Akun di dalam `/settings` | Halaman itu khusus Admin; tab di dalamnya tidak bisa dibuka peran lain |
| Ganti email tanpa kata sandi | Lihat §3 |
| Mencabut **semua** sesi saat ganti sandi | Memaksa login ulang di HP yang sedang dipegang, di tengah shift |
| Daftar perangkat lengkap | Butuh kolom `user_agent` baru; tanpa itu isinya hanya "perangkat tidak dikenal, 24 Nov 09.12" |
| Hapus / nonaktifkan akun sendiri | `created_by` di booking akan menggantung; penonaktifan tetap wewenang Admin (`CANNOT_DEACTIVATE_SELF`, `LAST_ADMIN`) |
| Pemilih bahasa & tema di halaman ini | Keduanya preferensi per perangkat, sudah ada di header |

---

## 8. Verifikasi

| Pemeriksaan | Hasil |
| :--- | :--- |
| `npx tsc -b` | lolos |
| `npx tsc -p server/tsconfig.json --noEmit` | lolos |
| `npx eslint` (berkas yang berubah) | 0 error, 0 warning baru |
| `npm test` (Vitest browser) | 352 tes lolos (42 berkas) |
| `npm run test:api` | 255 tes lolos (30 berkas) |
| Tangkapan layar 1280 px dan 375 px | tata letak rapi; tidak ada gulir mendatar |
