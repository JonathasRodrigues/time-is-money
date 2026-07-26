CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_user_id" varchar(128) NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "household_invitations_token_hash_uidx" ON "household_invitations" ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_invitations_household_status_idx" ON "household_invitations" ("household_id","status");
