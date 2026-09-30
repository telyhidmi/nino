CREATE TABLE IF NOT EXISTS "post_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "post_uploads_kind_check" CHECK ("post_uploads"."kind" in ('photo','video')),
	CONSTRAINT "post_uploads_size_check" CHECK ("post_uploads"."size" > 0 and "post_uploads"."size" <= case when "post_uploads"."kind" = 'photo' then 20971520 else 209715200 end)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"caption" text NOT NULL,
	"kind" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"author_name" text NOT NULL,
	"author_avatar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_kind_check" CHECK ("posts"."kind" in ('photo','video')),
	CONSTRAINT "posts_caption_check" CHECK (length("posts"."caption") <= 2200)
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_id_post_uploads_id_fk' AND conrelid = 'public.posts'::regclass) THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_id_post_uploads_id_fk" FOREIGN KEY ("id") REFERENCES "public"."post_uploads"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "post_uploads_owner_idx" ON "post_uploads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_created_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_owner_created_idx" ON "posts" USING btree ("owner_id","created_at");