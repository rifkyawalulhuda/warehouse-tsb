-- Lima desain tiket tambahan.
-- Rencana: permintaan 2026-11-24 ("tambah koleksi desain tiket"). Masing-masing
-- menutup kondisi yang tidak dilayani tiga desain pertama:
--
--   THERMAL     cetak thermal 58/80 mm dan fotokopi pudar — tanpa warna sama sekali
--   LARGE_CODE  QR gagal dipindai, petugas mengetik kode booking
--   NIGHT       tiket dibuka di gerbang malam
--   TEAROFF     tiket disobek petugas gate; stub memuat ulang kode dan dock
--   BRAND       pita memakai warna merek halaman masuk
--
-- Nilai enum ditambah, bukan tabel baru: desain tetap satu pilihan global dan
-- kartunya tetap digambar klien. `IF NOT EXISTS` menjaga migrasi ini bisa
-- dijalankan ulang di basis data yang sudah menerima nilainya.

ALTER TYPE "TicketDesign" ADD VALUE IF NOT EXISTS 'THERMAL';
ALTER TYPE "TicketDesign" ADD VALUE IF NOT EXISTS 'LARGE_CODE';
ALTER TYPE "TicketDesign" ADD VALUE IF NOT EXISTS 'NIGHT';
ALTER TYPE "TicketDesign" ADD VALUE IF NOT EXISTS 'TEAROFF';
ALTER TYPE "TicketDesign" ADD VALUE IF NOT EXISTS 'BRAND';

COMMENT ON COLUMN "warehouse_settings"."ticket_design" IS
  'Tata letak kartu tiket supir: CLASSIC, MINIMAL, NAVY, THERMAL, LARGE_CODE, NIGHT, TEAROFF, atau BRAND.';
