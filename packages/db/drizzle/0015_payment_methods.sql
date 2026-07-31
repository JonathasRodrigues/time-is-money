-- Formas de pagamento persistidas + FK em lançamentos/séries.

DO $$ BEGIN
  CREATE TYPE "public"."payment_method_type" AS ENUM('account', 'credit_card');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "household_id" uuid NOT NULL,
  "type" "payment_method_type" NOT NULL,
  "account_id" uuid NOT NULL,
  "credit_card_id" uuid,
  "payment_rail" varchar(16),
  "is_archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "payment_methods"
    ADD CONSTRAINT "payment_methods_household_id_households_id_fk"
    FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "payment_methods"
    ADD CONSTRAINT "payment_methods_account_id_accounts_id_fk"
    FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "payment_methods"
    ADD CONSTRAINT "payment_methods_credit_card_id_credit_cards_id_fk"
    FOREIGN KEY ("credit_card_id") REFERENCES "public"."credit_cards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payment_methods_household_idx" ON "payment_methods" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_account_idx" ON "payment_methods" USING btree ("account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_account_rail_uidx" ON "payment_methods" USING btree ("account_id", "payment_rail");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_card_uidx" ON "payment_methods" USING btree ("credit_card_id");
--> statement-breakpoint

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;
--> statement-breakpoint
ALTER TABLE "transaction_series" ADD COLUMN IF NOT EXISTS "default_payment_method_id" uuid;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_payment_method_id_payment_methods_id_fk"
    FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "transaction_series"
    ADD CONSTRAINT "transaction_series_default_payment_method_id_payment_methods_id_fk"
    FOREIGN KEY ("default_payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Seed: meios na conta (PIX/débito/TED/boleto) para contas que movem saldo.
INSERT INTO "payment_methods" ("household_id", "type", "account_id", "payment_rail")
SELECT a."household_id", 'account'::"payment_method_type", a."id", r.rail
FROM "accounts" a
CROSS JOIN (VALUES ('pix'), ('debit'), ('ted'), ('boleto')) AS r(rail)
WHERE a."kind" IN ('checking', 'savings', 'cash')
  AND a."is_archived" = false
ON CONFLICT ("account_id", "payment_rail") DO NOTHING;
--> statement-breakpoint

-- Seed: forma crédito por cartão (com crédito).
INSERT INTO "payment_methods" ("household_id", "type", "account_id", "credit_card_id", "payment_rail")
SELECT c."household_id", 'credit_card'::"payment_method_type", c."payment_account_id", c."id", NULL
FROM "credit_cards" c
WHERE c."is_archived" = false
  AND c."card_mode" IN ('credit', 'both')
  AND NOT EXISTS (
    SELECT 1 FROM "payment_methods" pm WHERE pm."credit_card_id" = c."id"
  );
--> statement-breakpoint

-- Backfill lançamentos: account + rail → payment_method_id.
UPDATE "transactions" t
SET "payment_method_id" = pm."id"
FROM "payment_methods" pm
WHERE t."payment_method_id" IS NULL
  AND pm."type" = 'account'
  AND pm."account_id" = t."account_id"
  AND pm."payment_rail" = COALESCE(t."payment_rail", 'pix')
  AND t."credit_card_id" IS NULL;
--> statement-breakpoint

-- Backfill lançamentos no crédito.
UPDATE "transactions" t
SET "payment_method_id" = pm."id"
FROM "payment_methods" pm
WHERE t."payment_method_id" IS NULL
  AND t."credit_card_id" IS NOT NULL
  AND pm."credit_card_id" = t."credit_card_id";
--> statement-breakpoint

-- Backfill séries.
UPDATE "transaction_series" s
SET "default_payment_method_id" = pm."id"
FROM "payment_methods" pm
WHERE s."default_payment_method_id" IS NULL
  AND pm."type" = 'account'
  AND pm."account_id" = s."account_id"
  AND pm."payment_rail" = COALESCE(s."default_payment_rail", 'pix');
