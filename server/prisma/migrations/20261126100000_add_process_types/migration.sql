-- Master "Jenis Proses": cara penanganan barang di dock.
--
-- Durasi di sini MENAMBAH durasi jenis truk (truk 60 + Curah 30 = 90 menit),
-- jadi jumlah blok yang dikunci tidak bisa disimpan di tabel ini: bergantung
-- pada pasangan truk + proses. Angka itu dihitung saat booking dibuat, lalu
-- disalin ke bookings.blocks_locked bersama process_extra_minutes dan
-- process_name agar riwayat tidak bergeser saat master diubah.
CREATE TABLE "process_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "process_types_pkey" PRIMARY KEY ("id")
);

-- NULL untuk booking yang dibuat sebelum fitur ini ada. ON DELETE SET NULL
-- karena menghapus master tidak boleh menghapus riwayat booking; nama yang
-- sudah dipakai tetap terbaca dari bookings.process_name.
ALTER TABLE "bookings" ADD COLUMN "process_type_id" INTEGER,
ADD COLUMN "process_extra_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "process_name" VARCHAR(80);

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_process_type_id_fkey"
FOREIGN KEY ("process_type_id") REFERENCES "process_types"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bookings_process_type_id_idx" ON "bookings"("process_type_id");