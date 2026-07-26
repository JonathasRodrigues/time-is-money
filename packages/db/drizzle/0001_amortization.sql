CREATE TYPE "public"."amortization_system" AS ENUM('price', 'sac', 'fixed');

ALTER TABLE "financings"
  ADD COLUMN "amortization_system" "amortization_system" DEFAULT 'fixed' NOT NULL;

ALTER TABLE "installments"
  ADD COLUMN "interest_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "principal_cents" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "balance_after_cents" integer DEFAULT 0 NOT NULL;
