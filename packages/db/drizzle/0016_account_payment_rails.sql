ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "allowed_payment_rails" jsonb DEFAULT '["pix","debit","ted","boleto"]'::jsonb NOT NULL;
