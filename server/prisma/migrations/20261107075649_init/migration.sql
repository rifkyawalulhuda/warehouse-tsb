-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CUSTOMER', 'GATE_OFFICER', 'CHECKER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LOADING', 'UNLOADING');

-- CreateEnum
CREATE TYPE "DockActivity" AS ENUM ('LOADING', 'UNLOADING', 'BOTH');

-- CreateEnum
CREATE TYPE "DockStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED_INCOMPLETE', 'BOOKED_READY', 'CHECKED_IN_ON_TIME', 'LATE_WAITING_LIST', 'DOCK_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "company_name" VARCHAR(160),
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(24),
    "password_hash" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "warehouse_name" VARCHAR(120) NOT NULL DEFAULT 'Gudang Utama',
    "operating_start_minute" INTEGER NOT NULL DEFAULT 480,
    "operating_end_minute" INTEGER NOT NULL DEFAULT 1020,
    "slot_unit_minutes" INTEGER NOT NULL DEFAULT 30,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 15,
    "early_arrival_limit_minutes" INTEGER NOT NULL DEFAULT 60,
    "booking_window_days" INTEGER NOT NULL DEFAULT 7,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_types" (
    "id" SERIAL NOT NULL,
    "truck_name" VARCHAR(80) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "blocks_required" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "truck_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "docks" (
    "id" SERIAL NOT NULL,
    "dock_code" VARCHAR(20) NOT NULL,
    "allowed_activity" "DockActivity" NOT NULL,
    "current_status" "DockStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "docks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "booking_code" VARCHAR(24) NOT NULL,
    "qr_token" VARCHAR(64) NOT NULL,
    "customer_id" UUID NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "truck_type_id" INTEGER NOT NULL,
    "booking_date" DATE NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "reference_doc_no" VARCHAR(80) NOT NULL,
    "license_plate" VARCHAR(20),
    "driver_name" VARCHAR(120),
    "driver_phone" VARCHAR(24),
    "assigned_dock_id" INTEGER,
    "status" "BookingStatus" NOT NULL,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_time_logs" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "vehicle_completed_at" TIMESTAMPTZ(3),
    "gate_in_at" TIMESTAMPTZ(3),
    "gate_in_by" UUID,
    "dock_assigned_at" TIMESTAMPTZ(3),
    "dock_assigned_by" UUID,
    "process_started_at" TIMESTAMPTZ(3),
    "process_started_by" UUID,
    "process_completed_at" TIMESTAMPTZ(3),
    "process_completed_by" UUID,
    "gate_out_at" TIMESTAMPTZ(3),
    "gate_out_by" UUID,

    CONSTRAINT "booking_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_allocations" (
    "id" SERIAL NOT NULL,
    "slot_date" DATE NOT NULL,
    "activity" "ActivityType" NOT NULL,
    "slot_start_minute" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "slot_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_day_sequences" (
    "booking_date" DATE NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "booking_day_sequences_pkey" PRIMARY KEY ("booking_date")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "user_role" "Role" NOT NULL,
    "acting_as_role" "Role",
    "action" VARCHAR(60) NOT NULL,
    "booking_id" UUID,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "docks_dock_code_key" ON "docks"("dock_code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_code_key" ON "bookings"("booking_code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_qr_token_key" ON "bookings"("qr_token");

-- CreateIndex
CREATE INDEX "bookings_booking_date_status_idx" ON "bookings"("booking_date", "status");

-- CreateIndex
CREATE INDEX "bookings_customer_id_booking_date_idx" ON "bookings"("customer_id", "booking_date");

-- CreateIndex
CREATE INDEX "bookings_status_start_time_idx" ON "bookings"("status", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "booking_time_logs_booking_id_key" ON "booking_time_logs"("booking_id");

-- CreateIndex
CREATE INDEX "slot_allocations_slot_date_activity_idx" ON "slot_allocations"("slot_date", "activity");

-- CreateIndex
CREATE UNIQUE INDEX "slot_allocations_slot_date_activity_slot_start_minute_key" ON "slot_allocations"("slot_date", "activity", "slot_start_minute");

-- CreateIndex
CREATE INDEX "audit_logs_booking_id_created_at_idx" ON "audit_logs"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_truck_type_id_fkey" FOREIGN KEY ("truck_type_id") REFERENCES "truck_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_dock_id_fkey" FOREIGN KEY ("assigned_dock_id") REFERENCES "docks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_gate_in_by_fkey" FOREIGN KEY ("gate_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_dock_assigned_by_fkey" FOREIGN KEY ("dock_assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_process_started_by_fkey" FOREIGN KEY ("process_started_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_process_completed_by_fkey" FOREIGN KEY ("process_completed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_time_logs" ADD CONSTRAINT "booking_time_logs_gate_out_by_fkey" FOREIGN KEY ("gate_out_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
