-- Gambar dan warna untuk sisi kanan halaman masuk, diatur Admin.
-- Keduanya nullable: kosong berarti halaman masuk memakai gradien bawaan.
ALTER TABLE "warehouse_settings"
  ADD COLUMN "login_cover_url" VARCHAR(2048),
  ADD COLUMN "login_brand_color" VARCHAR(7);
