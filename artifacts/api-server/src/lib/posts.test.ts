import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { postUploads } from "@workspace/db";
import { createPostsRouter } from "../routes/posts";
import { byteRange, checkFinalize, hasMediaSignature, PostError, requireOwner, requireSessionBearer, validateObject, validateTicket } from "./postValidation";

function rejects(status: number, run: () => unknown) {
  assert.throws(run, (error) => error instanceof PostError && error.status === status);
}
test("API auth policy: missing, malformed and unverified bearer rejected", () => {
  rejects(401, () => requireSessionBearer(undefined, "cookie-user"));
  rejects(401, () => requireSessionBearer("Basic token", "user"));
  rejects(401, () => requireSessionBearer("Bearer forged", null));
  assert.equal(requireSessionBearer("Bearer verified", "clerk-user"), "clerk-user");
});
test("API ownership policy: another user cannot publish, retry, or delete", () => {
  rejects(404, () => requireOwner("owner", "attacker"));
  rejects(404, () => checkFinalize("owner", "attacker", new Date(0), true, true));
});
test("upload kind and size limits", () => {
  rejects(400, () => validateTicket("video/mp4", 100, "photo"));
  rejects(400, () => validateTicket("image/jpeg", 20 * 1024 * 1024 + 1, "photo"));
  rejects(400, () => validateTicket("video/mp4", 200 * 1024 * 1024 + 1, "video"));
  validateTicket("image/jpeg", 20 * 1024 * 1024, "photo");
});
test("finalization validates actual storage metadata and magic bytes", () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  validateObject("image/png", 8, "image/png", 8, png);
  rejects(422, () => validateObject("image/png", 8, "text/html", 8, png));
  rejects(422, () => validateObject("image/png", 8, "image/png", 9, png));
  rejects(422, () => validateObject("image/png", 8, "image/png", 8, Buffer.from("<script>")));
  assert.equal(hasMediaSignature("image/svg+xml", Buffer.from("<svg>")), false);
});
test("idempotency permits retries after expiration but never resurrects deletions", () => {
  assert.equal(checkFinalize("owner", "owner", new Date(0), true, true), "existing");
  rejects(410, () => checkFinalize("owner", "owner", new Date(0), true, false));
  rejects(410, () => checkFinalize("owner", "owner", new Date(0), false, false));
  assert.equal(checkFinalize("owner", "owner", new Date(Date.now() + 60000), false, false), "publish");
});
test("video range policy supports suffix, open-ended, clamped and rejects multi-range", () => {
  assert.equal(byteRange(undefined, 100), null);
  assert.deepEqual(byteRange("bytes=10-20", 100), {start: 10, end: 20});
  assert.deepEqual(byteRange("bytes=90-", 100), {start: 90, end: 99});
  assert.deepEqual(byteRange("bytes=-10", 100), {start: 90, end: 99});
  assert.deepEqual(byteRange("bytes=90-999", 100), {start: 90, end: 99});
  for (const range of ["bytes=100-", "bytes=1-0", "bytes=-0", "bytes=0-1,3-4", "garbage"]) rejects(416, () => byteRange(range, 100));
});

test("HTTP contract: auth, strict validation, owner-only deletion and idempotent finalize", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const ticket = {
    id, ownerId: "owner", kind: "photo", contentType: "image/png", size: 8,
    expiresAt: new Date(Date.now() + 60000), finalizedAt: null as Date | null,
  };
  let stored: Record<string, unknown> | undefined;
  let finalizeCount = 0, removeCount = 0;
  const fakeDb = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const rows = table === postUploads ? [ticket] : stored ? [stored] : [];
          return Object.assign(Promise.resolve(rows), {for: () => Promise.resolve(rows)});
        },
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => {
          stored = {...value, createdAt: new Date()};
          return [stored];
        },
      }),
    }),
    update: () => ({set: (value: {finalizedAt: Date}) => ({where: async () => {ticket.finalizedAt = value.finalizedAt;}})}),
    delete: () => ({where: async () => {stored = undefined;}}),
    transaction: async (run: (tx: unknown) => unknown) => run(fakeDb),
  };
  const fakeClerk = {
    authenticateRequest: async (request: globalThis.Request) => ({
      toAuth: () => ({userId: request.headers.get("Authorization") === "Bearer owner" ? "owner" : request.headers.get("Authorization") === "Bearer other" ? "other" : null}),
    }),
    users: {getUser: async () => ({firstName: "Verified", lastName: "Author", hasImage: false, unsafeMetadata: {displayName: "  Nino Display Name  "}})},
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createPostsRouter({
    db: fakeDb, clerkClient: fakeClerk,
    finalizeMedia: async () => {finalizeCount++;},
    removeMedia: async () => {removeCount++;},
    mediaFile: () => {throw new Error("Unexpected storage access");},
    uploadUrl: async () => {throw new Error("Invalid request must not sign URLs");},
  } as unknown as Parameters<typeof createPostsRouter>[0]));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function call(path: string, method: string, token?: string, body?: unknown) {
    return fetch(base + path, {
      method, headers: {"Content-Type": "application/json", ...(token ? {Authorization: `Bearer ${token}`} : {})},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    assert.equal((await call("/posts", "GET")).status, 401);
    assert.equal((await call("/posts", "GET", "forged")).status, 401);
    assert.equal((await call("/posts/uploads", "POST", "owner", {contentType: "image/svg+xml", kind: "photo", size: 8})).status, 400);
    assert.equal((await call("/posts/uploads", "POST", "owner", {contentType: "image/png", kind: "photo", size: 8, ownerId: "other"})).status, 400);
    assert.equal((await call("/posts", "POST", "other", {uploadId: id, caption: "caption"})).status, 404);
    const first = await call("/posts", "POST", "owner", {uploadId: id, caption: "caption"});
    assert.equal(first.status, 200);
    const firstPost = await first.json() as {authorName: string; mediaUrl: string};
    assert.equal(firstPost.authorName, "Nino Display Name");
    assert.equal(firstPost.mediaUrl, `/api/posts/media/${id}`);
    const retry = await call("/posts", "POST", "owner", {uploadId: id, caption: "different"});
    assert.deepEqual(await retry.json(), firstPost);
    assert.equal(finalizeCount, 1);
    assert.equal((await call(`/posts/${id}`, "DELETE", "other")).status, 404);
    assert.equal(removeCount, 0);
    assert.equal((await call(`/posts/${id}`, "DELETE", "owner")).status, 204);
    assert.equal(removeCount, 1);
    assert.equal((await call(`/posts/media/${id}`, "GET")).status, 404);
    assert.equal((await call("/posts", "POST", "owner", {uploadId: id, caption: "resurrect"})).status, 410);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});