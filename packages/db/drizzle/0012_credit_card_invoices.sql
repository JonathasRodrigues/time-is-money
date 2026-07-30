DO $$ BEGIN
  CREATE TYPE "public"."credit_card_invoice_status" AS ENUM('open', 'closed', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
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
);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "credit_card_invoice_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_credit_card_id_credit_cards_id_fk" FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_invoices_household_idx" ON "credit_card_invoices" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_card_invoices_card_idx" ON "credit_card_invoices" USING btree ("credit_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_card_invoices_card_closes_uidx" ON "credit_card_invoices" USING btree ("credit_card_id","closes_on");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_invoice_id_credit_card_invoices_id_fk" FOREIGN KEY ("credit_card_invoice_id") REFERENCES "public"."credit_card_invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
