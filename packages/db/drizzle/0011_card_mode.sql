DO $$ BEGIN
  CREATE TYPE "public"."card_mode" AS ENUM('credit', 'debit', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD COLUMN IF NOT EXISTS "card_mode" "card_mode" DEFAULT 'credit' NOT NULL;
