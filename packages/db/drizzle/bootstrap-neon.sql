-- Time is Money — schema completo (migrations 0000→0005)
-- Banco VAZIO: cole no Neon → SQL Editor → Run
-- Alternativa preferida: DATABASE_URL=<neon> pnpm db:migrate

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== 0000_init.sql =====
-- Initial schema for Time is Money
CREATE TYPE "public"."member_role" AS ENUM('admin', 'editor', 'viewer');
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "public"."installment_status" AS ENUM('pending', 'paid', 'skipped');
CREATE TYPE "public"."import_status" AS ENUM('pending', 'preview', 'processing', 'completed', 'failed');
CREATE TYPE "public"."import_row_status" AS ENUM('ok', 'error', 'skip');
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system');
CREATE TYPE "public"."message_source" AS ENUM('text', 'voice');

CREATE TABLE "households" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "clerk_org_id" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "email" varchar(255),
  "role" "member_role" DEFAULT 'viewer' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "memberships_household_user_uidx" ON "memberships" ("household_id","user_id");

CREATE TABLE "cost_centers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "name" varchar(120) NOT NULL,
  "color" varchar(32),
  "is_system" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "parent_id" uuid,
  "name" varchar(120) NOT NULL,
  "type" "transaction_type" NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "category_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE cascade,
  "alias" varchar(120) NOT NULL
);

CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "cost_center_id" uuid NOT NULL REFERENCES "cost_centers"("id") ON DELETE cascade,
  "name" varchar(120) NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "cost_center_id" uuid NOT NULL REFERENCES "cost_centers"("id"),
  "category_id" uuid NOT NULL REFERENCES "categories"("id"),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "type" "transaction_type" NOT NULL,
  "amount_cents" integer NOT NULL,
  "occurred_on" varchar(10) NOT NULL,
  "description" varchar(500),
  "notes_encrypted" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "source" varchar(32) DEFAULT 'manual' NOT NULL,
  "duplicate_hash" varchar(64),
  "deleted_at" timestamp with time zone,
  "created_by" varchar(128),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "financings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "cost_center_id" uuid NOT NULL REFERENCES "cost_centers"("id"),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "name" varchar(160) NOT NULL,
  "institution" varchar(160),
  "principal_cents" integer NOT NULL,
  "installment_count" integer NOT NULL,
  "installment_amount_cents" integer NOT NULL,
  "annual_rate_bps" integer,
  "first_due_on" varchar(10) NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "installments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "financing_id" uuid NOT NULL REFERENCES "financings"("id") ON DELETE cascade,
  "number" integer NOT NULL,
  "due_on" varchar(10) NOT NULL,
  "amount_cents" integer NOT NULL,
  "status" "installment_status" DEFAULT 'pending' NOT NULL,
  "paid_on" varchar(10),
  "transaction_id" uuid REFERENCES "transactions"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "action" varchar(64) NOT NULL,
  "resource_type" varchar(64) NOT NULL,
  "resource_id" varchar(64),
  "source" varchar(32) DEFAULT 'app' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "default_cost_center_id" uuid,
  "default_account_id" uuid,
  "email_due_reminders" boolean DEFAULT true NOT NULL,
  "reminder_windows_days" jsonb DEFAULT '[7,3,1]'::jsonb,
  "weekly_summary" boolean DEFAULT false NOT NULL,
  "tts_enabled" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "user_prefs_household_user_uidx" ON "user_preferences" ("household_id","user_id");

CREATE TABLE "notification_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "kind" varchar(64) NOT NULL,
  "reference_id" varchar(64) NOT NULL,
  "window_days" integer NOT NULL,
  "sent_on" varchar(10) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "notification_outbox_uidx" ON "notification_outbox" ("user_id","kind","reference_id","window_days","sent_on");

CREATE TABLE "jarvis_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "title" varchar(160),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "jarvis_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL REFERENCES "jarvis_threads"("id") ON DELETE cascade,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "role" "message_role" NOT NULL,
  "source" "message_source" DEFAULT 'text' NOT NULL,
  "content" text NOT NULL,
  "intent" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "status" "import_status" DEFAULT 'pending' NOT NULL,
  "file_name" varchar(255),
  "format" varchar(16) NOT NULL,
  "mapping" jsonb DEFAULT '{}'::jsonb,
  "error_summary" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE "import_job_rows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "import_jobs"("id") ON DELETE cascade,
  "row_number" integer NOT NULL,
  "status" "import_row_status" NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb,
  "reason" text
);

CREATE TABLE "export_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL REFERENCES "households"("id") ON DELETE cascade,
  "user_id" varchar(128) NOT NULL,
  "format" varchar(16) NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== 0001_amortization.sql =====
CREATE TYPE "public"."amortization_system" AS ENUM('price', 'sac', 'fixed');

ALTER TABLE "financings"
  ADD COLUMN "amortization_system" "amortization_system" DEFAULT 'fixed' NOT NULL;

ALTER TABLE "installments"
  ADD COLUMN "interest_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "principal_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "balance_after_cents" integer DEFAULT 0 NOT NULL;

-- ===== 0002_payments.sql =====
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'paid');
CREATE TYPE "public"."series_interval" AS ENUM('monthly');
CREATE TABLE "transaction_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"cost_center_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "transaction_type" DEFAULT 'expense' NOT NULL,
	"description" varchar(500) NOT NULL,
	"interval" "series_interval" DEFAULT 'monthly' NOT NULL,
	"due_day" integer NOT NULL,
	"default_amount_cents" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD COLUMN "status" "transaction_status" DEFAULT 'paid' NOT NULL;
ALTER TABLE "transactions" ADD COLUMN "due_on" varchar(10);
ALTER TABLE "transactions" ADD COLUMN "paid_on" varchar(10);
ALTER TABLE "transactions" ADD COLUMN "series_id" uuid;
ALTER TABLE "transactions" ADD COLUMN "installment_id" uuid;
ALTER TABLE "transactions" ALTER COLUMN "amount_cents" DROP NOT NULL;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_series_id_transaction_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."transaction_series"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "transactions_installment_uidx" ON "transactions" USING btree ("installment_id");
UPDATE "transactions" SET "paid_on" = "occurred_on" WHERE "status" = 'paid' AND "paid_on" IS NULL;
UPDATE "transactions" SET "due_on" = "occurred_on" WHERE "due_on" IS NULL;

-- ===== 0003_income_day.sql =====
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "income_day" integer;
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "last_income_confirmed_month" varchar(7);
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "income_prompt_snoozed_on" varchar(10);

-- ===== 0004_institutions_accounts.sql =====
CREATE TYPE "public"."account_kind" AS ENUM('cash', 'checking', 'investment_pot');
CREATE TYPE "public"."yield_type" AS ENUM('none', 'cdi', 'fixed_annual');
CREATE TABLE IF NOT EXISTS "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "institution_id" uuid;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "parent_account_id" uuid;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "kind" "account_kind" DEFAULT 'checking' NOT NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "balance_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "yield_type" "yield_type" DEFAULT 'none' NOT NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "yield_bps" integer;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 0005_account_transfers.sql =====
CREATE TABLE IF NOT EXISTS "account_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"occurred_on" varchar(10) NOT NULL,
	"description" varchar(500),
	"created_by" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "account_transfers_household_occurred_idx" ON "account_transfers" ("household_id","occurred_on");


-- ===== 0009_theme.sql =====
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "theme" varchar(16) DEFAULT 'system' NOT NULL;
