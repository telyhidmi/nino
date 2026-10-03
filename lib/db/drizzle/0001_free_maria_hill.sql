CREATE TABLE "messaging_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_low" text NOT NULL,
	"member_high" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"read_low" integer DEFAULT 0 NOT NULL,
	"read_high" integer DEFAULT 0 NOT NULL,
	"unread_low" integer DEFAULT 0 NOT NULL,
	"unread_high" integer DEFAULT 0 NOT NULL,
"updated_at" timestamp with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL,
	CONSTRAINT "messaging_pair_order" CHECK ("messaging_conversations"."member_low" < "messaging_conversations"."member_high"),
	CONSTRAINT "messaging_watermark_bounds" CHECK ("messaging_conversations"."read_low" between 0 and "messaging_conversations"."sequence" and "messaging_conversations"."read_high" between 0 and "messaging_conversations"."sequence" and "messaging_conversations"."unread_low" >= 0 and "messaging_conversations"."unread_high" >= 0)
);
--> statement-breakpoint
CREATE TABLE "messaging_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"client_nonce" uuid NOT NULL,
	"text" text NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_text_bounds" CHECK (length("messaging_messages"."text") between 1 and 2000 and length(btrim("messaging_messages"."text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "messaging_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"username" text,
	"avatar_url" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messaging_conversations" ADD CONSTRAINT "messaging_conversations_member_low_messaging_profiles_id_fk" FOREIGN KEY ("member_low") REFERENCES "public"."messaging_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_conversations" ADD CONSTRAINT "messaging_conversations_member_high_messaging_profiles_id_fk" FOREIGN KEY ("member_high") REFERENCES "public"."messaging_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_conversation_id_messaging_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messaging_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_sender_id_messaging_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."messaging_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_pair_idx" ON "messaging_conversations" USING btree ("member_low","member_high");--> statement-breakpoint
CREATE INDEX "messaging_low_inbox_idx" ON "messaging_conversations" USING btree ("member_low","updated_at","id");--> statement-breakpoint
CREATE INDEX "messaging_high_inbox_idx" ON "messaging_conversations" USING btree ("member_high","updated_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_sender_nonce_idx" ON "messaging_messages" USING btree ("sender_id","client_nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_thread_sequence_idx" ON "messaging_messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_recording_location_check" CHECK (("posts"."country_code" is null and "posts"."recorded_at" is null) or ("posts"."kind" = 'video' and "posts"."country_code" is not null and "posts"."country_code" ~ '^[A-Z]{2}$' and "posts"."recorded_at" is not null));