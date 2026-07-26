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
);--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_transfers_household_occurred_idx" ON "account_transfers" ("household_id","occurred_on");
