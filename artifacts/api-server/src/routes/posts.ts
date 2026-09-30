import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import { and, desc, eq } from "drizzle-orm";
import { db, posts, postUploads, type PostRow } from "@workspace/db";
import { RequestPostUploadBody, PublishPostBody } from "@workspace/api-zod";
import { byteRange, checkFinalize, PostError, requireOwner, requireSessionBearer, UPLOAD_TTL_MS, validateRecordingLocation, validateTicket } from "../lib/postValidation";
import { finalizeMedia, mediaUrl, removeMedia, uploadUrl } from "../lib/postStorage";

export function createPostsRouter(dependencies = {db, clerkClient, finalizeMedia, mediaUrl, removeMedia, uploadUrl, fetchMedia: globalThis.fetch}) {
const {db: database, clerkClient: clerk, finalizeMedia: finalize, mediaUrl: signMedia, removeMedia: remove, uploadUrl: signUpload, fetchMedia} = dependencies;
const router: IRouter = Router();
function serialize(post: PostRow) {
  return {
    id: post.id, ownerId: post.ownerId, caption: post.caption, kind: post.kind,
    mediaUrl: `/api/posts/media/${post.id}`, createdAt: post.createdAt.toISOString(),
    authorName: post.authorName, authorAvatar: post.authorAvatar,
    recordingLocation: post.countryCode && post.recordedAt
      ? {countryCode: post.countryCode, recordedAt: post.recordedAt.toISOString()}
      : null,
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
  res.set("Cache-Control", "no-store");
  // Listen before ANY asynchronous work: a player may cancel while the DB,
  // signer, or upstream headers are still pending.
  const controller = new AbortController();
  const closed = () => {
    if (!res.writableFinished) controller.abort();
  };
  req.on("aborted", closed);
  res.on("close", closed);
  let upstream: globalThis.Response | undefined;
  try {
  if (req.aborted || res.destroyed) controller.abort();
  const id = validId(req.params.id);
  const [post] = await database.select().from(posts).where(eq(posts.id, id));
  if (controller.signal.aborted) return;
  if (!post) throw new PostError(404, "Not found");
  validateTicket(post.contentType, post.size, post.kind);
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
  const length = end - start + 1;
  const url = await signMedia(id, controller.signal);
  if (controller.signal.aborted) return;
  upstream = await fetchMedia(url, {
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
    headers: {"Accept-Encoding": "identity", ...(range ? {Range: `bytes=${start}-${end}`} : {})},
    redirect: "error",
  });
  if (controller.signal.aborted) return;
  if (upstream.status === 404) throw new PostError(404, "Published media is missing");
  // Do not trust upstream headers to override the validated DB media contract.
  if (upstream.status !== (range ? 206 : 200) ||
      upstream.headers.get("content-length") !== String(length) ||
      upstream.headers.get("content-range") !== (range ? `bytes ${start}-${end}/${post.size}` : null) ||
      ![null, "identity"].includes(upstream.headers.get("content-encoding")) ||
      !upstream.body) {
    throw new PostError(502, "Storage returned invalid media");
  }
  if (range) res.status(206).set("Content-Range", `bytes ${start}-${end}/${post.size}`);
  res.set("Content-Length", String(length));
  if (req.method === "HEAD") { res.end(); return; }
  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      callback(received > length ? new Error("Invalid media length") : null, received > length ? undefined : chunk);
    },
    flush(callback) {
      callback(received !== length ? new Error("Invalid media length") : null);
    },
  });
  // Unlike the GCS SDK stream, this standard stream can safely be destroyed
  // before headers arrive or during pipeline teardown.
  await pipeline(Readable.fromWeb(upstream.body), limit, res, {signal: controller.signal});
  } catch (error) {
    if (controller.signal.aborted) return;
    // Fetch errors may contain a signed URL. Never forward their original cause.
    if (error instanceof PostError) throw error;
    throw new PostError(502, "Could not read published media");
  } finally {
    controller.abort();
    if (upstream?.body && !upstream.body.locked) {
      await upstream.body.cancel().catch(() => {});
    }
    req.off("aborted", closed);
    res.off("close", closed);
  }
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
  const recordingLocation = validateRecordingLocation(req.body.recordingLocation);
  const post = await database.transaction(async (tx) => {
    const [upload] = await tx.select().from(postUploads).where(eq(postUploads.id, uploadId)).for("update");
    if (!upload) throw new PostError(404, "Upload ticket not found");
    // Check ownership before returning an idempotent result.
    requireOwner(upload.ownerId, ownerId);
    if (recordingLocation && upload.kind !== "video") throw new PostError(400, "Recording location is only allowed for videos");
    const [existing] = await tx.select().from(posts).where(eq(posts.id, uploadId));
    // The first successful publish owns the metadata; retries never update it.
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
      countryCode: recordingLocation?.countryCode ?? null,
      recordedAt: recordingLocation?.recordedAt ?? null,
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
  if (res.destroyed) return;
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