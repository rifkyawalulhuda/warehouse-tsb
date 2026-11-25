-- Baris footer yang bisa diganti Admin. NULL berarti layar memakai teks
-- bawaan, yang mengikuti bahasa aktif (Indonesia/Inggris), jadi gudang yang
-- tidak menyentuh Pengaturan tidak melihat perubahan apa pun.
ALTER TABLE "warehouse_settings"
  ADD COLUMN "footer_company" VARCHAR(200),
  ADD COLUMN "footer_location" VARCHAR(120);