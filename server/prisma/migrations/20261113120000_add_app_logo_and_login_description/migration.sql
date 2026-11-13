-- Logo aplikasi dan paragraf sambutan halaman masuk, diatur Admin.
-- Keduanya nullable: kosong berarti logo memakai lencana huruf pertama dan
-- halaman masuk memakai teks bawaan.
ALTER TABLE "warehouse_settings"
  ADD COLUMN "app_logo_url" VARCHAR(2048),
  ADD COLUMN "login_description" VARCHAR(240);
