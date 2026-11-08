-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- Seeded dari nama gudang yang sudah ada di pengaturan, supaya nama yang
-- tercetak di tiket tidak berubah setelah kolom ini muncul.
INSERT INTO "warehouses" ("name")
SELECT "warehouse_name" FROM "warehouse_settings" WHERE "id" = 1;

-- Kalau pengaturan belum pernah terisi, tetap harus ada satu baris supaya
-- seluruh dock lama bisa menunjuk ke sesuatu.
INSERT INTO "warehouses" ("name")
SELECT 'Gudang Utama'
WHERE NOT EXISTS (SELECT 1 FROM "warehouses");

-- AlterTable: kolom dulu nullable, baru diisi, baru dijadikan NOT NULL —
-- tabel docks sudah berisi 6 baris sehingga tidak bisa langsung wajib diisi.
ALTER TABLE "docks" ADD COLUMN "area_name" VARCHAR(80);
ALTER TABLE "docks" ADD COLUMN "warehouse_id" INTEGER;

UPDATE "docks" SET "warehouse_id" = (SELECT "id" FROM "warehouses" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "docks" ALTER COLUMN "warehouse_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "docks" ADD CONSTRAINT "docks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
