-- Time is Money — delta 0006→0014 (idempotente onde possível)
-- Use se o Neon JÁ tem schema antigo (até transfers) e falta planning/cartões.
-- Preferível: DATABASE_URL=<neon> pnpm db:migrate
-- Banco VAZIO: use bootstrap-neon.sql em vez deste arquivo.

-- ===== 0006_household_invitations.sql =====
DO $$ BEGIN
  CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "household_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_user_id" varchar(128) NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "household_invitations_token_hash_uidx" ON "household_invitations" ("token_hash");
CREATE INDEX IF NOT EXISTS "household_invitations_household_status_idx" ON "household_invitations" ("household_id","status");

-- ===== 0007_planning.sql =====
DO $$ BEGIN
  CREATE TYPE "public"."financing_category" AS ENUM('real_estate', 'vehicle', 'personal', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."plan_kind" AS ENUM('travel', 'financing_payoff', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "financings" ADD COLUMN IF NOT EXISTS "category" "financing_category" DEFAULT 'other' NOT NULL;

CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" "plan_kind" NOT NULL,
	"name" varchar(160) NOT NULL,
	"target_date" varchar(10) NOT NULL,
	"linked_account_id" uuid,
	"financing_id" uuid,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"label" varchar(120) NOT NULL,
	"amount_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "plans" ADD CONSTRAINT "plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plans" ADD CONSTRAINT "plans_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plans" ADD CONSTRAINT "plans_financing_id_financings_id_fk" FOREIGN KEY ("financing_id") REFERENCES "public"."financings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "plans_household_deleted_idx" ON "plans" USING btree ("household_id","deleted_at");

CREATE INDEX IF NOT EXISTS "plan_items_plan_idx" ON "plan_items" USING btree ("plan_id","sort_order");

-- ===== 0008_plan_contributions.sql =====
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "monthly_target_cents" integer;

CREATE TABLE IF NOT EXISTS "plan_contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"due_on" varchar(10) NOT NULL,
	"amount_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "plan_contributions" ADD CONSTRAINT "plan_contributions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "plan_contributions" ADD CONSTRAINT "plan_contributions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "plan_contributions_plan_idx" ON "plan_contributions" USING btree ("plan_id","sort_order");

-- ===== 0009_theme.sql =====
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "theme" varchar(16) DEFAULT 'system' NOT NULL;

-- ===== 0010_credit_cards.sql =====
ALTER TYPE "public"."account_kind" ADD VALUE IF NOT EXISTS 'savings';
CREATE TABLE IF NOT EXISTS "credit_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"last_four" varchar(4),
	"credit_limit_cents" integer DEFAULT 0 NOT NULL,
	"invoice_balance_cents" integer DEFAULT 0 NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_payment_account_id_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "credit_cards_household_idx" ON "credit_cards" USING btree ("household_id");
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_account_id_accounts_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "credit_card_id" uuid;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payment_rail" varchar(16);
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 0011_card_mode.sql =====
DO $$ BEGIN
  CREATE TYPE "public"."card_mode" AS ENUM('credit', 'debit', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "credit_cards" ADD COLUMN IF NOT EXISTS "card_mode" "card_mode" DEFAULT 'credit' NOT NULL;

-- ===== 0012_credit_card_invoices.sql =====
DO $$ BEGIN
  CREATE TYPE "public"."credit_card_invoice_status" AS ENUM('open', 'closed', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "credit_card_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"closes_on" varchar(10) NOT NULL,
	"due_on" varchar(10) NOT NULL,
	"status" "credit_card_invoice_status" DEFAULT 'open' NOT NULL,
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "credit_card_invoice_id" uuid;
DO $$ BEGIN
  ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "credit_card_invoices_household_idx" ON "credit_card_invoices" USING btree ("household_id");
CREATE INDEX IF NOT EXISTS "credit_card_invoices_card_idx" ON "credit_card_invoices" USING btree ("credit_card_id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_card_invoices_card_closes_uidx" ON "credit_card_invoices" USING btree ("credit_card_id","closes_on");
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_invoice_id_credit_card_invoices_id_fk" FOREIGN KEY ("credit_card_invoice_id") REFERENCES "public"."credit_card_invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== 0013_series_payment_rail.sql =====
ALTER TABLE "transaction_series" ADD COLUMN IF NOT EXISTS "default_payment_rail" varchar(16);

-- ===== 0014_real_estate_amortization.sql =====
ALTER TYPE "public"."plan_kind" ADD VALUE IF NOT EXISTS 'real_estate_amortization';
