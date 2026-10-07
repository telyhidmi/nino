import { sql } from "drizzle-orm";
import { pgTable, text, uuid, integer, boolean, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const messagingProfiles = pgTable("messaging_profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("messaging_name_search_idx").on(sql`lower(${t.displayName}) text_pattern_ops`),
  index("messaging_username_search_idx").on(sql`lower(${t.username}) text_pattern_ops`),
]);
export const messagingFollows = pgTable("messaging_follows", {
  followerId: text("follower_id").notNull().references(() => messagingProfiles.id),
  followedId: text("followed_id").notNull().references(() => messagingProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("messaging_follow_pair_idx").on(t.followerId, t.followedId),
  check("messaging_no_self_follow", sql`${t.followerId} <> ${t.followedId}`),
]);
export const messagingConversations = pgTable("messaging_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberLow: text("member_low").notNull().references(() => messagingProfiles.id),
  memberHigh: text("member_high").notNull().references(() => messagingProfiles.id),
  sequence: integer("sequence").notNull().default(0),
  messagingUnlocked: boolean("messaging_unlocked").notNull().default(false),
  blockedLow: boolean("blocked_low").notNull().default(false),
  blockedHigh: boolean("blocked_high").notNull().default(false),
  readLow: integer("read_low").notNull().default(0),
  readHigh: integer("read_high").notNull().default(0),
  unreadLow: integer("unread_low").notNull().default(0),
  unreadHigh: integer("unread_high").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`date_trunc('milliseconds', now())`),
}, (t) => [
  uniqueIndex("messaging_pair_idx").on(t.memberLow, t.memberHigh),
  index("messaging_low_inbox_idx").on(t.memberLow, t.updatedAt, t.id),
  index("messaging_high_inbox_idx").on(t.memberHigh, t.updatedAt, t.id),
  check("messaging_pair_order", sql`${t.memberLow} < ${t.memberHigh}`),
  check("messaging_watermark_bounds", sql`${t.readLow} between 0 and ${t.sequence} and ${t.readHigh} between 0 and ${t.sequence} and ${t.unreadLow} >= 0 and ${t.unreadHigh} >= 0`),
]);
export const messagingMessages = pgTable("messaging_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => messagingConversations.id),
  senderId: text("sender_id").notNull().references(() => messagingProfiles.id),
  clientNonce: uuid("client_nonce").notNull(),
  text: text("text").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("messaging_sender_nonce_idx").on(t.senderId, t.clientNonce),
  uniqueIndex("messaging_thread_sequence_idx").on(t.conversationId, t.sequence),
  index("messaging_thread_sender_idx").on(t.conversationId, t.senderId),
  check("messaging_text_bounds", sql`length(${t.text}) between 1 and 2000 and length(btrim(${t.text})) > 0`),
]);
export const insertMessagingProfileSchema = createInsertSchema(messagingProfiles);
export const insertMessagingConversationSchema = createInsertSchema(messagingConversations);
export const insertMessagingMessageSchema = createInsertSchema(messagingMessages);
export type MessagingProfileRow = typeof messagingProfiles.$inferSelect;
export type MessagingConversationRow = typeof messagingConversations.$inferSelect;
export type MessagingMessageRow = typeof messagingMessages.$inferSelect;