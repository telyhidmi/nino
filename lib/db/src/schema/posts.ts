import { pgTable, uuid, text, integer, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const postUploads = pgTable("post_uploads", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind", { enum: ["photo", "video"] }).notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // Keep tombstones so deleting a post cannot make its ticket reusable.
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
}, (t) => [
  index("post_uploads_owner_idx").on(t.ownerId),
  check("post_uploads_kind_check", sql`${t.kind} in ('photo','video')`),
  check("post_uploads_size_check", sql`${t.size} > 0 and ${t.size} <= case when ${t.kind} = 'photo' then 20971520 else 209715200 end`),
]);

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().references(() => postUploads.id),
  ownerId: text("owner_id").notNull(),
  caption: text("caption").notNull(),
  kind: text("kind", { enum: ["photo", "video"] }).notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  authorName: text("author_name").notNull(),
  authorAvatar: text("author_avatar"),
  countryCode: text("country_code"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("posts_created_idx").on(t.createdAt),
  index("posts_owner_created_idx").on(t.ownerId, t.createdAt),
  check("posts_kind_check", sql`${t.kind} in ('photo','video')`),
  check("posts_caption_check", sql`length(${t.caption}) <= 2200`),
  check("posts_recording_location_check", sql`(${t.countryCode} is null and ${t.recordedAt} is null) or (${t.kind} = 'video' and ${t.countryCode} is not null and ${t.countryCode} ~ '^[A-Z]{2}$' and ${t.recordedAt} is not null)`),
]);

export type PostRow = typeof posts.$inferSelect;