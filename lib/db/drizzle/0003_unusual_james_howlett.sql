CREATE TABLE "messaging_follows" (
	"follower_id" text NOT NULL,
	"followed_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_no_self_follow" CHECK ("messaging_follows"."follower_id" <> "messaging_follows"."followed_id")
);
--> statement-breakpoint
ALTER TABLE "messaging_conversations" ADD COLUMN "messaging_unlocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messaging_follows" ADD CONSTRAINT "messaging_follows_follower_id_messaging_profiles_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."messaging_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_follows" ADD CONSTRAINT "messaging_follows_followed_id_messaging_profiles_id_fk" FOREIGN KEY ("followed_id") REFERENCES "public"."messaging_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messaging_follow_pair_idx" ON "messaging_follows" USING btree ("follower_id","followed_id");--> statement-breakpoint
CREATE INDEX "messaging_thread_sender_idx" ON "messaging_messages" USING btree ("conversation_id","sender_id");