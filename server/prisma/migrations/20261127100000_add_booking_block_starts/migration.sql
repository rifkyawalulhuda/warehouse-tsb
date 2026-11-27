-- Salinan blok yang dikunci saat booking dibuat, bukan hanya jumlahnya.
--
-- Sampai sekarang pelepasan kuota menghitung ulang posisi blok dari pengaturan
-- yang berlaku saat itu. Akibatnya Admin yang mengubah jam buka atau satuan blok
-- membuat pembatalan booking lama gagal dengan SLOT_NOT_ALIGNED, dan job NO_SHOW
-- / approval-expiry berhenti untuk SEMUA booking karena satu baris yang tidak
-- sejajar. Menyimpan posisi blok membuat pelepasan selalu menunjuk baris
-- slot_allocations yang sama, berapa pun pengaturan yang berubah kemudian.
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "block_starts" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Isi untuk booking yang sudah ada, memakai satuan blok yang berlaku sekarang.
-- Untuk gudang yang belum pernah mengubah satuan blok hasilnya persis; untuk
-- yang pernah mengubahnya ini tetap lebih baik daripada array kosong, karena
-- blok pertama (jam mulai booking) pasti benar.
UPDATE "bookings" AS b
SET "block_starts" = ARRAY(
  SELECT (
    EXTRACT(HOUR FROM (b."start_time" AT TIME ZONE 'Asia/Jakarta'))::int * 60
    + EXTRACT(MINUTE FROM (b."start_time" AT TIME ZONE 'Asia/Jakarta'))::int
    + g * s."slot_unit_minutes"
  )
  FROM generate_series(0, b."blocks_locked" - 1) AS g
)
FROM "warehouse_settings" AS s
WHERE s."id" = 1
  AND b."blocks_locked" > 0;
