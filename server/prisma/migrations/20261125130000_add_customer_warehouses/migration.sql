-- Gudang yang boleh dipakai satu customer.
--
-- Tabel ini adalah DAFTAR IZIN: customer tanpa baris di sini bebas memakai
-- semua gudang. Customer dengan baris hanya boleh diberi dock di gudang yang
-- tercantum. Sengaja daftar izin, bukan daftar larangan, supaya menambah
-- gudang baru tidak diam-diam membuka akses bagi customer yang sudah dibatasi.
CREATE TABLE "customer_warehouses" (
    "customer_id" UUID NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_warehouses_pkey" PRIMARY KEY ("customer_id", "warehouse_id")
);

-- Pencarian terbalik "siapa saja yang boleh di gudang ini" untuk laporan admin.
CREATE INDEX "customer_warehouses_warehouse_id_idx" ON "customer_warehouses"("warehouse_id");

-- Menghapus customer atau gudang ikut membersihkan izinnya; baris izin tidak
-- punya arti tanpa keduanya.
ALTER TABLE "customer_warehouses"
    ADD CONSTRAINT "customer_warehouses_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_warehouses"
    ADD CONSTRAINT "customer_warehouses_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;