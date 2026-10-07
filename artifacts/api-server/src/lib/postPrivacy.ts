import { createHmac, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";

// Reuse the server's private session key so replicas can verify the same links.
// Never log these query strings or include them in user-facing Share links.
function signingKey() {
  if (!process.env.SESSION_SECRET) throw new Error("Media signing is not configured");
  return process.env.SESSION_SECRET;
}
export function mediaAccessToken(postId: string, viewerId: string): string {
  const payload = Buffer.from(JSON.stringify({p:postId,v:viewerId,e:Date.now()+6*60*60*1000})).toString("base64url");
  return `${payload}.${createHmac("sha256",signingKey()).update(payload).digest("base64url")}`;
}
export function mediaViewer(postId: string, token: unknown): string | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [payload,signature,extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256",signingKey()).update(payload).digest();
  const received = Buffer.from(signature,"base64url");
  if (received.length !== expected.length || !timingSafeEqual(received,expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload,"base64url").toString());
    return data.p === postId && typeof data.v === "string" && typeof data.e === "number" && data.e > Date.now() ? data.v : null;
  } catch { return null; }
}
export async function canViewOwner(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (ownerId === viewerId) return true;
  const result = await pool.query(`SELECT NOT EXISTS(
    SELECT 1 FROM messaging_profiles p WHERE p.id=$1 AND p.private_account
      AND NOT EXISTS(SELECT 1 FROM messaging_follows f WHERE f.followed_id=p.id AND f.follower_id=$2)
  ) AS allowed`, [ownerId,viewerId]);
  return result.rows[0].allowed;
}
