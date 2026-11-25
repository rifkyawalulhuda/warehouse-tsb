-- Admin bisa menyembunyikan baris lokasi footer. Tanpa ini, Admin yang sudah
-- menulis lokasi pada baris pertama tetap melihat lokasi bawaan di baris kedua —
-- dobel. Bawaannya true agar footer yang sudah ada tidak berubah.
ALTER TABLE "warehouse_settings"
  ADD COLUMN "footer_show_location" BOOLEAN NOT NULL DEFAULT true;
