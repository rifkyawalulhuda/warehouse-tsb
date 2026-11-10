-- Riwayat gate: jejak pemindaian yang gagal + indeks untuk menyaring jam gate.
-- Rencana: grilling 2026-11-10 (riwayat untuk Security, Admin, dan Checker).
--
-- Sebelum migrasi ini, `GET /ops/scan/:qrToken` hanya melempar galat untuk QR
-- yang tidak dikenali; tidak ada satu baris pun yang ditulis. Akibatnya riwayat
-- gate mustahil memuat kejadian yang justru paling perlu dipertanggungjawabkan.
-- Tabel ini hanya menyimpan percobaan yang GAGAL: gate-in dan gate-out sudah
-- tercatat di `booking_time_logs` + `audit_logs`.

-- ======================= 1. Tabel scan_attempts =======================

CREATE TABLE "scan_attempts" (
  "id"         UUID NOT NULL,
  "qr_token"   VARCHAR(128) NOT NULL,
  "reason"     VARCHAR(40) NOT NULL,
  "message"    VARCHAR(240) NOT NULL,
  "user_id"    UUID,
  "user_role"  "Role" NOT NULL,
  "booking_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scan_attempts_pkey" PRIMARY KEY ("id")
);

-- Riwayat selalu diurutkan dan disaring menurut waktu.
CREATE INDEX "scan_attempts_created_at_idx" ON "scan_attempts"("created_at");

-- Mencari jejak satu tiket tertentu ("QR ini pernah dipindai berapa kali?").
CREATE INDEX "scan_attempts_qr_token_created_at_idx" ON "scan_attempts"("qr_token", "created_at");

ALTER TABLE "scan_attempts"
  ADD CONSTRAINT "scan_attempts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scan_attempts"
  ADD CONSTRAINT "scan_attempts_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ================= 2. Indeks jam gate pada time logs =================
-- Riwayat disaring menurut instant gate-in/gate-out, bukan `booking_date`:
-- truk shift malam bisa masuk setelah tengah malam, dan tanggal booking akan
-- menempatkannya di hari yang salah.

CREATE INDEX "booking_time_logs_gate_in_at_idx" ON "booking_time_logs"("gate_in_at");
CREATE INDEX "booking_time_logs_gate_out_at_idx" ON "booking_time_logs"("gate_out_at");
