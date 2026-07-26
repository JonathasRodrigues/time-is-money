ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "income_day" integer;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "last_income_confirmed_month" varchar(7);--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "income_prompt_snoozed_on" varchar(10);
