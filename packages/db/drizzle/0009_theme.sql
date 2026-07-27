ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "theme" varchar(16) DEFAULT 'system' NOT NULL;
