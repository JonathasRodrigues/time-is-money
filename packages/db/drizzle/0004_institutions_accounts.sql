CREATE TYPE "public"."account_kind" AS ENUM('cash', 'checking', 'investment_pot');--> statement-breakpoint
CREATE TYPE "public"."yield_type" AS ENUM('none', 'cdi', 'fixed_annual');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "institution_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "parent_account_id" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "kind" "account_kind" DEFAULT 'checking' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "balance_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "yield_type" "yield_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "yield_bps" integer;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
