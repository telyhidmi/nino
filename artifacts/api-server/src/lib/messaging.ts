import type { Pool, PoolClient, QueryResultRow } from "@workspace/db";
import type { MessagingProfile, MessagingMessage, MessagingConversation } from "@workspace/api-zod";

export class MessagingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
interface ConversationRow extends QueryResultRow {
  id: string; member_low: string; member_high: string; sequence: number;
  read_low: number; read_high: number; unread_low: number; unread_high: number; updated_at: Date;
}
interface MessageRow extends QueryResultRow {
  id: string; conversation_id: string; sender_id: string; client_nonce: string;
  text: string; sequence: number; created_at: Date;
}
const message = (m: MessageRow): MessagingMessage => ({
  id: m.id, conversationId: m.conversation_id, senderId: m.sender_id,
  clientNonce: m.client_nonce, text: m.text, sequence: m.sequence, createdAt: m.created_at.toISOString(),
});
function encodeCursor(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function decodeCursor(raw: string): unknown {
  try {
    if (raw.length > 300 || !/^[\w-]+$/.test(raw)) throw new Error();
    return JSON.parse(Buffer.from(raw, "base64url").toString());
  } catch { throw new MessagingError(400, "Invalid pagination cursor"); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class MessagingService {
  constructor(private pool: Pool) {}
  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async syncProfile(profile: MessagingProfile) {
    await this.pool.query(`INSERT INTO messaging_profiles(id,display_name,username,avatar_url)
      VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET display_name=$2,username=$3,avatar_url=$4,synced_at=now()`,
    [profile.id, profile.displayName, profile.username, profile.avatarUrl]);
    return profile;
  }
  async search(userId: string, query: string) {
    // Indexed public-name prefix search. Escape LIKE operators; never search an email.
    const pattern = `${query.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
    const result = await this.pool.query(`SELECT id,display_name AS "displayName",username,avatar_url AS "avatarUrl"
      FROM messaging_profiles WHERE id <> $1 AND (lower(display_name) LIKE $2 OR lower(username) LIKE $2)
      ORDER BY lower(display_name),id LIMIT 20`, [userId, pattern]);
    return result.rows as MessagingProfile[];
  }
  private async member(client: Pool | PoolClient, id: string, userId: string, lock = false) {
    const result = await client.query<ConversationRow>(
      `SELECT * FROM messaging_conversations WHERE id=$1 AND (member_low=$2 OR member_high=$2)${lock ? " FOR UPDATE" : ""}`, [id,userId]);
    if (!result.rows[0]) throw new MessagingError(404, "Conversation not found");
    return result.rows[0];
  }
  private async summaries(client: Pool | PoolClient, rows: ConversationRow[], userId: string): Promise<MessagingConversation[]> {
    if (!rows.length) return [];
    const ids = rows.map((c) => c.id);
    // Two bounded batch queries; no per-conversation SDK or database calls.
    const profiles = await client.query(`SELECT id,display_name AS "displayName",username,avatar_url AS "avatarUrl"
      FROM messaging_profiles WHERE id=ANY($1::text[])`, [rows.map((c) => c.member_low === userId ? c.member_high : c.member_low)]);
    const messages = await client.query<MessageRow>(`SELECT m.* FROM messaging_conversations c
      JOIN messaging_messages m ON m.conversation_id=c.id AND m.sequence=c.sequence
      WHERE c.id=ANY($1::uuid[])`, [ids]);
    const byProfile = new Map<string, MessagingProfile>(profiles.rows.map((p) => [p.id, p as MessagingProfile]));
    const byMessage = new Map(messages.rows.map((m) => [m.conversation_id, message(m)]));
    return rows.map((c) => {
      const peer = byProfile.get(c.member_low === userId ? c.member_high : c.member_low);
      if (!peer) throw new Error("Public profile missing");
      return {id: c.id, peer, lastMessage: byMessage.get(c.id) ?? null,
        unreadCount: c.member_low === userId ? c.unread_low : c.unread_high,
        updatedAt: c.updated_at.toISOString()};
    });
  }
  async create(userId: string, peerId: string) {
    if (userId === peerId) throw new MessagingError(400, "You cannot message yourself");
    // Let PostgreSQL choose ordering using its collation, consistent with the CHECK constraint.
    const result = await this.pool.query<ConversationRow>(`INSERT INTO messaging_conversations(member_low,member_high)
      VALUES(least($1::text,$2::text),greatest($1::text,$2::text))
      ON CONFLICT(member_low,member_high) DO UPDATE SET member_low=EXCLUDED.member_low RETURNING *`, [userId,peerId]);
    return (await this.summaries(this.pool, result.rows, userId))[0];
  }
  async inbox(userId: string, rawCursor?: string) {
    let timestamp: string | null = null, id: string | null = null;
    if (rawCursor) {
      const cursor = decodeCursor(rawCursor) as {t?: unknown; id?: unknown};
      if (!cursor || typeof cursor.t !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(cursor.t) ||
        !Number.isFinite(Date.parse(cursor.t)) || typeof cursor.id !== "string" || !uuid.test(cursor.id))
        throw new MessagingError(400, "Invalid pagination cursor");
      timestamp = cursor.t; id = cursor.id;
    }
    // UNION uses both per-member ordered indexes, never scans the full inbox table.
    const result = await this.pool.query<ConversationRow>(`SELECT * FROM (
      (SELECT * FROM messaging_conversations WHERE member_low=$1 AND ($2::timestamptz IS NULL OR (updated_at,id)<($2::timestamptz,$3::uuid)) ORDER BY updated_at DESC,id DESC LIMIT 31)
      UNION ALL
      (SELECT * FROM messaging_conversations WHERE member_high=$1 AND ($2::timestamptz IS NULL OR (updated_at,id)<($2::timestamptz,$3::uuid)) ORDER BY updated_at DESC,id DESC LIMIT 31)
      ) c ORDER BY updated_at DESC,id DESC LIMIT 31`, [userId,timestamp,id]);
    const page = result.rows.slice(0,30), last = page.at(-1);
    return {conversations: await this.summaries(this.pool, page, userId),
      nextCursor: result.rows.length > 30 && last ? encodeCursor({t:last.updated_at.toISOString(),id:last.id}) : null};
  }
  async thread(userId: string, id: string, rawCursor?: string) {
    const conversation = await this.member(this.pool, id, userId);
    let before: number | null = null;
    if (rawCursor) {
      const cursor = decodeCursor(rawCursor) as {id?: unknown; s?: unknown};
      if (!cursor || cursor.id !== id || typeof cursor.s !== "number" || !Number.isSafeInteger(cursor.s) || cursor.s < 1)
        throw new MessagingError(400, "Invalid pagination cursor");
      before = cursor.s;
    }
    const result = await this.pool.query<MessageRow>(`SELECT * FROM messaging_messages
      WHERE conversation_id=$1 AND ($2::integer IS NULL OR sequence<$2) ORDER BY sequence DESC LIMIT 51`, [id,before]);
    const page = result.rows.slice(0,50), last = page.at(-1);
    return {conversation: (await this.summaries(this.pool,[conversation],userId))[0], messages:page.map(message),
      nextCursor: result.rows.length > 50 && last ? encodeCursor({id,s:last.sequence}) : null};
  }
  async send(userId: string, id: string, text: string, nonce: string) {
    return this.transaction(async (client) => {
      const conversation = await this.member(client,id,userId,true);
      // Same sender nonce may race across different conversations: serialize per nonce as well.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${userId}:${nonce}`]);
      const previous = await client.query<MessageRow>("SELECT * FROM messaging_messages WHERE sender_id=$1 AND client_nonce=$2", [userId,nonce]);
      if (previous.rows[0]) {
        const m = previous.rows[0];
        if (m.conversation_id !== id || m.text !== text) throw new MessagingError(409,"This message nonce was already used");
        return message(m);
      }
      const sequence = conversation.sequence + 1;
      const result = await client.query<MessageRow>(`INSERT INTO messaging_messages(conversation_id,sender_id,client_nonce,text,sequence,created_at)
        VALUES($1,$2,$3,$4,$5,clock_timestamp()) RETURNING *`, [id,userId,nonce,text,sequence]);
      const receiverColumn = conversation.member_low === userId ? "unread_high" : "unread_low";
      // Millisecond precision is intentional: inbox cursors serialize JS dates without precision loss.
      await client.query(`UPDATE messaging_conversations SET sequence=$2,${receiverColumn}=${receiverColumn}+1,
        updated_at=greatest(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') WHERE id=$1`, [id,sequence]);
      return message(result.rows[0]);
    });
  }
  async read(userId: string, id: string, messageId: string) {
    return this.transaction(async (client) => {
      const c = await this.member(client,id,userId,true);
      const result = await client.query<{sequence: number}>("SELECT sequence FROM messaging_messages WHERE id=$1 AND conversation_id=$2", [messageId,id]);
      if (!result.rows[0]) throw new MessagingError(404,"Message not found");
      const side = c.member_low === userId ? "low" : "high";
      const old = side === "low" ? c.read_low : c.read_high;
      const observed = Math.max(old,result.rows[0].sequence);
      const counted = await client.query<{count: number}>(`SELECT count(*)::integer AS count FROM messaging_messages
        WHERE conversation_id=$1 AND sequence>$2 AND sequence<=$3 AND sender_id<>$4`, [id,old,observed,userId]);
      const changed = await client.query(`UPDATE messaging_conversations SET read_${side}=$2,unread_${side}=unread_${side}-$3
        WHERE id=$1 RETURNING read_${side} AS "readSequence",unread_${side} AS "unreadCount"`, [id,observed,counted.rows[0].count]);
      return changed.rows[0] as {readSequence: number; unreadCount: number};
    });
  }
}
let singleton: MessagingService | undefined;
export async function messagingService() {
  if (!singleton) {
    const { pool } = await import("@workspace/db");
    singleton = new MessagingService(pool);
  }
  return singleton;
}