CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'paid');--> statement-breakpoint
CREATE TYPE "public"."series_interval" AS ENUM('monthly');--> statement-breakpoint
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
);--> statement-breakpoint
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_series" ADD CONSTRAINT "transaction_series_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" "transaction_status" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "due_on" varchar(10);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paid_on" varchar(10);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "installment_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "amount_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_series_id_transaction_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."transaction_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_installment_uidx" ON "transactions" USING btree ("installment_id");--> statement-breakpoint
UPDATE "transactions" SET "paid_on" = "occurred_on" WHERE "status" = 'paid' AND "paid_on" IS NULL;--> statement-breakpoint
UPDATE "transactions" SET "due_on" = "occurred_on" WHERE "due_on" IS NULL;
