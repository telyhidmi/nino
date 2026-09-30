import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { and, desc, eq } from "drizzle-orm";
import { db, posts, postUploads, type PostRow } from "@workspace/db";
import { RequestPostUploadBody, PublishPostBody } from "@workspace/api-zod";
import { byteRange, checkFinalize, PostError, requireOwner, requireSessionBearer, UPLOAD_TTL_MS, validateTicket } from "../lib/postValidation";
import { finalizeMedia, mediaFile, removeMedia, uploadUrl } from "../lib/postStorage";

export function createPostsRouter(dependencies = {db, clerkClient, finalizeMedia, mediaFile, removeMedia, uploadUrl}) {
const {db: database, clerkClient: clerk, finalizeMedia: finalize, mediaFile: fileForMedia, removeMedia: remove, uploadUrl: signUpload} = dependencies;
const router: IRouter = Router();
function serialize(post: PostRow) {
  return {
    id: post.id, ownerId: post.ownerId, caption: post.caption, kind: post.kind,
    mediaUrl: `/api/posts/media/${post.id}`, createdAt: post.createdAt.toISOString(),
    authorName: post.authorName, authorAvatar: post.authorAvatar,
  };
}
async function user(req: Request) {
  const header = req.headers.authorization;
  if (!header || !/^Bearer \S+$/i.test(header)) throw new PostError(401, "A verified Clerk session bearer token is required");
  // Verify ONLY the bearer, excluding cookies. A valid cookie must not make an
  // invalid bearer acceptable, and machine/API tokens must not identify users.
  const state = await clerk.authenticateRequest(new globalThis.Request("https://nino.invalid/api/posts", {
    headers: {Authorization: header},
  }), {acceptsToken: "session_token"});
  return requireSessionBearer(header, state.toAuth()?.userId);
}
function validId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new PostError(404, "Not found");
  return value;
}

router.get("/posts/media/:id", async (req, res) => {
  const id = validId(req.params.id);
  const [post] = await database.select().from(posts).where(eq(posts.id, id));
  if (!post) throw new PostError(404, "Not found");
  const file = fileForMedia(id);
  const [exists] = await file.exists();
  if (!exists) throw new PostError(404, "Published media is missing");
  res.set({
    "Content-Type": post.contentType,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
    // Do not let shared caches continue serving deleted posts.
    "Cache-Control": "no-store",
  });
  let range;
  try { range = byteRange(req.headers.range, post.size); }
  catch (error) {
    res.set("Content-Range", `bytes */${post.size}`);
    throw error;
  }
  const start = range?.start ?? 0, end = range?.end ?? post.size - 1;
  if (range) res.status(206).set("Content-Range", `bytes ${start}-${end}/${post.size}`);
  res.set("Content-Length", String(end - start + 1));
  if (req.method === "HEAD") { res.end(); return; }
  await pipeline(file.createReadStream({start, end}), res);
});

router.post("/posts/uploads", async (req, res) => {
  const ownerId = await user(req);
  const parsed = RequestPostUploadBody.strict().safeParse(req.body);
  if (!parsed.success) throw new PostError(400, "Invalid upload request");
  const {contentType, size, kind} = parsed.data;
  validateTicket(contentType, size, kind);
  const uploadId = randomUUID();
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  const signedUrl = await signUpload(uploadId, expiresAt);
  await database.insert(postUploads).values({id: uploadId, ownerId, contentType, size, kind, expiresAt});
  res.json({uploadId, uploadUrl: signedUrl});
});

router.get("/posts", async (req, res) => {
  await user(req);
  res.json({posts: (await database.select().from(posts).orderBy(desc(posts.createdAt), desc(posts.id))).map(serialize)});
});
router.get("/posts/mine", async (req, res) => {
  const ownerId = await user(req);
  res.json({posts: (await database.select().from(posts).where(eq(posts.ownerId, ownerId)).orderBy(desc(posts.createdAt), desc(posts.id))).map(serialize)});
});
router.post("/posts", async (req, res) => {
  const ownerId = await user(req);
  const parsed = PublishPostBody.strict().safeParse(req.body);
  if (!parsed.success) throw new PostError(400, "Invalid publish request");
  const {uploadId, caption} = parsed.data;
  const post = await database.transaction(async (tx) => {
    const [upload] = await tx.select().from(postUploads).where(eq(postUploads.id, uploadId)).for("update");
    if (!upload) throw new PostError(404, "Upload ticket not found");
    // Check ownership before returning an idempotent result.
    requireOwner(upload.ownerId, ownerId);
    const [existing] = await tx.select().from(posts).where(eq(posts.id, uploadId));
    if (checkFinalize(upload.ownerId, ownerId, upload.expiresAt, !!upload.finalizedAt, !!existing) === "existing") return existing;
    const profile = await clerk.users.getUser(ownerId);
    // unsafeMetadata is user-editable display data, never an authorization
    // source. Fetch it from Clerk and validate the Nino display-name limit.
    const metadataName = profile.unsafeMetadata?.displayName;
    const trimmedName = typeof metadataName === "string" ? metadataName.trim() : "";
    const displayName = trimmedName.length > 0 && trimmedName.length <= 40 ? trimmedName : "";
    const authorName = displayName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username || "Nino member";
    const authorAvatar = profile.hasImage ? profile.imageUrl : null;
    await finalize(uploadId, upload.contentType, upload.size);
    const [created] = await tx.insert(posts).values({
      id: uploadId, ownerId, caption, kind: upload.kind, contentType: upload.contentType,
      size: upload.size, authorName, authorAvatar,
    }).returning();
    await tx.update(postUploads).set({finalizedAt: new Date()}).where(eq(postUploads.id, uploadId));
    return created;
  });
  res.json(serialize(post));
});

router.delete("/posts/:id", async (req, res) => {
  const ownerId = await user(req), id = validId(req.params.id);
  await database.transaction(async (tx) => {
    // Same lock as publication: cannot race deletion with a finalize retry.
    const [upload] = await tx.select().from(postUploads).where(eq(postUploads.id, id)).for("update");
    if (!upload) throw new PostError(404, "Not found");
    requireOwner(upload.ownerId, ownerId);
    const [post] = await tx.select().from(posts).where(and(eq(posts.id, id), eq(posts.ownerId, ownerId)));
    if (!post) throw new PostError(404, "Not found");
    await remove(id);
    await tx.delete(posts).where(and(eq(posts.id, id), eq(posts.ownerId, ownerId)));
  });
  res.status(204).end();
});

router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) { next(error); return; }
  if (error instanceof PostError) { res.status(error.status).json({error: error.message}); return; }
  // SDK errors can contain request headers, signed URLs, or credentials.
  // Never serialize external error objects into application logs.
  req.log.error({event: "post_service_failure"}, "Post request failed");
  res.status(500).json({error: "Post service failed. Please retry."});
});
return router;
}
export default createPostsRouter();