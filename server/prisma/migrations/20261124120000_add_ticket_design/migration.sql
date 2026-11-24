-- Pilihan tata letak kartu tiket supir.
-- Rencana: permintaan 2026-11-24 ("user bisa memilih desain tiket dari
-- Pengaturan", tiga desain: Klasik Biru, Minimal Putih, Navy Resmi).
--
-- Desain disimpan sebagai satu nilai global, bukan per booking: Admin memilih
-- satu gaya untuk semua tiket, dan tiket yang tautannya dibuka ulang ikut
-- berganti. Kalau nanti desain perlu dikunci per booking, kolomnya ditambah di
-- tabel bookings, bukan di sini.
--
-- Bawaan CLASSIC sama dengan tata letak yang selama ini dipakai, sehingga
-- migrasi ini tidak mengubah tampilan tiket apa pun sampai Admin menyimpannya.

CREATE TYPE "TicketDesign" AS ENUM ('CLASSIC', 'MINIMAL', 'NAVY');

ALTER TABLE "warehouse_settings"
  ADD COLUMN "ticket_design" "TicketDesign" NOT NULL DEFAULT 'CLASSIC';

COMMENT ON COLUMN "warehouse_settings"."ticket_design" IS
  'Tata letak kartu tiket supir: CLASSIC, MINIMAL, atau NAVY.';
