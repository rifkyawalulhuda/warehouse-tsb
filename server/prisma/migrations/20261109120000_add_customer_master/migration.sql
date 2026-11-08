-- Master Data Customer: memisahkan perusahaan (customers) dari akun login (users).
-- Rencana: docs/rencana-master-customer.md
--
-- RISIKO UTAMA yang dikendalikan migrasi ini:
-- `bookings.customer_id` hari ini menunjuk ke `users.id`. Kalau artinya diubah
-- diam-diam menjadi `customers.id`, TypeScript tidak akan mengeluh (tipenya sama-sama
-- String) dan tiga tempat akan salah tanpa error: my-list kosong, otorisasi selalu
-- gagal, realtime mati. Karena itu kolom lama DI-RENAME menjadi `created_by_id`
-- sehingga setiap pemakai dipaksa diperiksa kompilator.

-- ============================ 1. Tabel customers ============================

CREATE TABLE "customers" (
  "id"                    UUID NOT NULL,
  "code"                  VARCHAR(24) NOT NULL,
  "name"                  VARCHAR(160) NOT NULL,
  "address"               VARCHAR(240),
  "city"                  VARCHAR(80),
  "pic_name"              VARCHAR(120),
  "phone"                 VARCHAR(24),
  "email"                 VARCHAR(160),
  "tax_id"                VARCHAR(40),
  "note"                  VARCHAR(240),
  "is_active"             BOOLEAN NOT NULL DEFAULT true,
  "auto_approve_booking"  BOOLEAN NOT NULL DEFAULT false,
  "created_at"            TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");
CREATE UNIQUE INDEX "customers_name_key" ON "customers"("name");
-- Nama unik case-insensitive: "PT ABC" dan "pt abc" tidak boleh jadi dua customer.
CREATE UNIQUE INDEX "customers_name_lower_key" ON "customers"(lower("name"));

-- ===================== 2. Backfill dari akun CUSTOMER =====================
-- Gabung per company_name (trim, case-insensitive). Akun dengan nama yang sama
-- menjadi satu customer; whitelist approval digabung dengan OR.
-- Kode memakai urutan alfabetis nama agar deterministic.

INSERT INTO "customers" ("id", "code", "name", "auto_approve_booking", "is_active")
SELECT
  gen_random_uuid(),
  'CUST-' || lpad((row_number() OVER (ORDER BY g.sort_name))::text, 3, '0'),
  g.display_name,
  g.auto_approve,
  true
FROM (
  SELECT
    lower(btrim("company_name")) AS sort_name,
    min(btrim("company_name"))   AS display_name,
    bool_or("auto_approve_booking") AS auto_approve
  FROM "users"
  WHERE "role" = 'CUSTOMER'
    AND "company_name" IS NOT NULL
    AND btrim("company_name") <> ''
  GROUP BY lower(btrim("company_name"))
) g;

-- Fallback: akun CUSTOMER tanpa company_name mendapat customer sendiri.
-- Booking lamanya tetap punya pemilik; nama ini sengaja jelas agar Admin merapikannya.
INSERT INTO "customers" ("id", "code", "name", "auto_approve_booking", "is_active")
SELECT
  gen_random_uuid(),
  'CUST-' || lpad((row_number() OVER (ORDER BY lower("email")) + (SELECT count(*) FROM "customers"))::text, 3, '0'),
  'Customer ' || "email",
  "auto_approve_booking",
  true
FROM "users"
WHERE "role" = 'CUSTOMER'
  AND ("company_name" IS NULL OR btrim("company_name") = '');

-- ======================= 3. Tautkan akun ke customer ======================

ALTER TABLE "users" ADD COLUMN "customer_id" UUID;

-- Akun dengan company_name -> customer hasil penggabungan.
UPDATE "users" u
SET "customer_id" = c."id"
FROM "customers" c
WHERE u."role" = 'CUSTOMER'
  AND u."company_name" IS NOT NULL
  AND btrim(u."company_name") <> ''
  AND lower(c."name") = lower(btrim(u."company_name"));

-- Akun tanpa company_name -> customer fallback miliknya sendiri.
UPDATE "users" u
SET "customer_id" = c."id"
FROM "customers" c
WHERE u."role" = 'CUSTOMER'
  AND u."customer_id" IS NULL
  AND c."name" = 'Customer ' || u."email";

-- Gagal keras bila masih ada akun CUSTOMER yatim. Lebih baik migrasi berhenti
-- di sini daripada menghasilkan booking tanpa pemilik perusahaan.
DO $$
DECLARE
  orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM "users" WHERE "role" = 'CUSTOMER' AND "customer_id" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Migrasi dibatalkan: % akun CUSTOMER tidak punya customer', orphans;
  END IF;
END $$;

ALTER TABLE "users"
  ADD CONSTRAINT "users_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_customer_id_idx" ON "users"("customer_id");

-- ==================== 4. Booking: rename + kolom baru ====================
-- Kolom lama menunjuk users.id (pembuat). Rename agar namanya jujur; FK-nya
-- tetap valid sehingga hanya perlu di-rename, bukan dibuat ulang.

ALTER TABLE "bookings" RENAME COLUMN "customer_id" TO "created_by_id";
ALTER TABLE "bookings" RENAME CONSTRAINT "bookings_customer_id_fkey" TO "bookings_created_by_id_fkey";
ALTER INDEX "bookings_customer_id_booking_date_idx" RENAME TO "bookings_created_by_id_booking_date_idx";

ALTER TABLE "bookings" ADD COLUMN "customer_id" UUID;

-- Pemilik bisnis = customer dari akun pembuat.
UPDATE "bookings" b
SET "customer_id" = u."customer_id"
FROM "users" u
WHERE b."created_by_id" = u."id";

DO $$
DECLARE
  orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM "bookings" WHERE "customer_id" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Migrasi dibatalkan: % booking tidak punya pemilik customer', orphans;
  END IF;
END $$;

ALTER TABLE "bookings" ALTER COLUMN "customer_id" SET NOT NULL;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "bookings_customer_id_booking_date_idx" ON "bookings"("customer_id", "booking_date");
CREATE INDEX "bookings_created_by_id_idx" ON "bookings"("created_by_id");

-- ============== 5. Buang kolom yang sudah pindah ke customer ==============

ALTER TABLE "users" DROP COLUMN "auto_approve_booking";
ALTER TABLE "users" DROP COLUMN "company_name";

-- ======================= 6. Catat penggabungan di audit ==================
-- Wajib: penggabungan per company_name bisa menyatukan dua entitas yang
-- sebenarnya berbeda, dan itu harus bisa ditelusuri tanpa membaca SQL.

INSERT INTO "audit_logs" ("id", "user_id", "user_role", "acting_as_role", "action", "booking_id", "meta", "created_at")
SELECT
  gen_random_uuid(),
  NULL,
  'ADMIN',
  'ADMIN',
  'CUSTOMER_MASTER_MIGRATED',
  NULL,
  jsonb_build_object(
    'customersCreated', (SELECT count(*) FROM "customers"),
    'accountsLinked', (SELECT count(*) FROM "users" WHERE "customer_id" IS NOT NULL),
    'bookingsBackfilled', (SELECT count(*) FROM "bookings"),
    'mergedNames', (
      SELECT coalesce(jsonb_agg(name ORDER BY name), '[]'::jsonb)
      FROM "customers"
    )
  ),
  CURRENT_TIMESTAMP;
