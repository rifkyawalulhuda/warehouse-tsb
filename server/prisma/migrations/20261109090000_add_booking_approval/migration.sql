-- Fitur persetujuan booking (approval dinamis).
-- Rencana: docs/rencana-approval-booking.md §3.5
--
-- Prinsip: rilis ini TIDAK mengubah perilaku satu pun booking yang sudah ada.
-- - warehouse_settings.approval_mode default AUTO  -> semua booking langsung sah.
-- - bookings.approval_status default NOT_REQUIRED  -> tidak ada yang masuk antrean.
-- - users.auto_approve_booking default false       -> whitelist kosong, aman karena mode AUTO.

-- 1. Enum baru.
CREATE TYPE "ApprovalMode" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- 2. Kebijakan di tingkat gudang.
ALTER TABLE "warehouse_settings"
  ADD COLUMN "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'AUTO',
  ADD COLUMN "approval_lead_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "approval_min_decision_minutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "approval_urgent_buffer_minutes" INTEGER NOT NULL DEFAULT 1440;

-- 3. Flag per pengguna.
ALTER TABLE "users"
  ADD COLUMN "auto_approve_booking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "can_approve_booking" BOOLEAN NOT NULL DEFAULT false;

-- 4. Sumbu persetujuan pada booking.
ALTER TABLE "bookings"
  ADD COLUMN "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "approval_deadline" TIMESTAMPTZ(3),
  ADD COLUMN "approved_by_id" UUID,
  ADD COLUMN "approved_at" TIMESTAMPTZ(3),
  ADD COLUMN "rejection_reason" VARCHAR(240),
  ADD COLUMN "quota_released_at" TIMESTAMPTZ(3);

-- 5. Backfill historis: booking lama tidak pernah melalui approval, jadi tandai
--    NOT_REQUIRED. Sengaja bukan APPROVED: riwayatnya harus jujur.
UPDATE "bookings"
SET "approval_status" = 'NOT_REQUIRED'
WHERE "approval_status" IS NULL;

-- 6. FK approver. SetNull supaya menghapus akun tidak menghapus riwayat booking.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Indeks untuk job expire dan antrean.
CREATE INDEX "bookings_approval_status_approval_deadline_idx"
  ON "bookings"("approval_status", "approval_deadline");
CREATE INDEX "bookings_approval_status_booking_date_idx"
  ON "bookings"("approval_status", "booking_date");
