-- Kolom `admin_contact_phone` tidak pernah dibaca kode mana pun dan tidak ada di
-- schema.prisma. Selama kolomnya tertinggal, `prisma migrate dev` akan terus
-- mengusulkan migrasi untuk membuangnya. Dihapus di sini secara eksplisit.
--
-- `IF EXISTS` menjaga migrasi ini tetap sah di database yang dibuat dari nol
-- (di sana kolom itu dibuat lalu langsung dibuang oleh dua migrasi berurutan).
ALTER TABLE "warehouse_settings"
  DROP COLUMN IF EXISTS "admin_contact_phone";
