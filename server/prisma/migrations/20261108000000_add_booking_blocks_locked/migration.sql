-- Snapshot jumlah blok yang dikunci per booking.
--
-- Tanpa kolom ini, melepas kuota (batal / NO_SHOW) membaca
-- `truck_types.blocks_required` saat ini, bukan angka yang benar-benar
-- dikunci saat booking dibuat. Mengubah durasi jenis truk kemudian akan
-- melepas jumlah blok yang salah dan membuat kuota bocor permanen.

-- 1. Tambah kolom sebagai nullable dulu supaya baris lama bisa diisi ulang.
ALTER TABLE "bookings" ADD COLUMN "blocks_locked" INTEGER;

-- 2. Isi baris lama dari jenis truknya masing-masing.
UPDATE "bookings" b
SET "blocks_locked" = tt."blocks_required"
FROM "truck_types" tt
WHERE b."truck_type_id" = tt."id";

-- 3. Jadikan wajib. Bila masih ada NULL di sini berarti data rusak, dan lebih
--    baik migrasi gagal dengan jelas daripada diam-diam melepas 0 blok.
ALTER TABLE "bookings" ALTER COLUMN "blocks_locked" SET NOT NULL;
