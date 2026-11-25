-- Dipulihkan: migrasi ini pernah dijalankan di database dev (2026-11-12) tetapi
-- berkasnya tidak pernah masuk repo, sehingga `prisma migrate status` menganggap
-- riwayat lokal dan database berbeda dan `migrate dev` menawarkan reset.
--
-- Isinya disusun ulang dari keadaan database (kolom `admin_contact_phone`
-- VARCHAR(24) NULL di warehouse_settings). `IF NOT EXISTS` membuat migrasi ini
-- aman dijalankan pada database yang kolomnya sudah ada.
--
-- Kolomnya sendiri sudah tidak dipakai kode mana pun; penghapusannya ada di
-- migrasi 20261125110000_drop_admin_contact_phone.
ALTER TABLE "warehouse_settings"
  ADD COLUMN IF NOT EXISTS "admin_contact_phone" VARCHAR(24);
