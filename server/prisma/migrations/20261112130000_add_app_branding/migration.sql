-- Judul aplikasi yang dapat diubah Admin.
-- Rencana: permintaan 2026-11-12 ("Warehouse TSB" dan "Time Slot Booking" bisa
-- diganti dari Pengaturan).
--
-- Sebelumnya ketiga teks ini tertanam di kode frontend: sidebar, halaman masuk,
-- dan judul tab peramban. Akibatnya mengganti nama produk berarti mengubah kode
-- dan membangun ulang, padahal nama itu urusan operasional, bukan teknis.
--
-- Nilai bawaan sengaja sama dengan teks yang selama ini tertanam, sehingga
-- migrasi ini tidak mengubah tampilan apa pun sampai Admin menyimpannya.

ALTER TABLE "warehouse_settings"
  ADD COLUMN "app_name"       VARCHAR(60) NOT NULL DEFAULT 'Warehouse TSB',
  ADD COLUMN "app_tagline"    VARCHAR(80) NOT NULL DEFAULT 'Time Slot Booking',
  ADD COLUMN "app_short_name" VARCHAR(20);

-- Nama pendek untuk judul tab peramban; NULL berarti pakai `app_name`.
COMMENT ON COLUMN "warehouse_settings"."app_short_name" IS
  'Judul tab dan layar sempit. NULL = pakai app_name.';
