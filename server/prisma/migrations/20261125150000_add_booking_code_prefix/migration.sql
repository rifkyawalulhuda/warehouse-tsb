-- Awalan kode booking bisa diganti Admin (mis. TSB -> TKT).
--
-- Hanya kode BARU yang memakai awalan ini. Kode lama tidak diubah: pengenalan
-- kode di layar gate bekerja dari bentuk `ABC-YYYYMMDD-NNN`, bukan dari huruf
-- awalannya, sehingga tiket yang sudah tercetak tetap bisa dipindai.
ALTER TABLE "warehouse_settings"
  ADD COLUMN IF NOT EXISTS "booking_code_prefix" VARCHAR(3) NOT NULL DEFAULT 'TSB';
