import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { createServer, request } from "node:http";
import { db, posts, postUploads, messagingFollows } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { PublishPostBody } from "@workspace/api-zod";
import { createPostsRouter } from "../routes/posts";
import { byteRange, checkFinalize, hasMediaSignature, PostError, requireOwner, requireSessionBearer, validateObject, validateRecordingLocation, validateTicket } from "./postValidation";

function rejects(status: number, run: () => unknown) {
  assert.throws(run, (error) => error instanceof PostError && error.status === status);
}
test("following feed selects persisted follow targets scoped to the authenticated member", () => {
  const followed = db.select({id: messagingFollows.followedId}).from(messagingFollows)
    .where(eq(messagingFollows.followerId, "authenticated-member"));
  const query = db.select().from(posts).where(inArray(posts.ownerId, followed)).toSQL();
  assert.deepEqual(query.params, ["authenticated-member"]);
  assert.match(query.sql, /"owner_id" in \(select "followed_id" from "messaging_follows"/);
  assert.match(query.sql, /"follower_id" = \$1/);
});
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

test("recording metadata: full ISO list, strict shape, calendar dates and five-minute skew", () => {
  const now = Date.parse("2026-01-01T12:00:00Z");
  const location = {countryCode: "AX", recordedAt: "2025-12-31T23:00:00+01:00"};
  assert.equal(PublishPostBody.shape.recordingLocation.unwrap().shape.countryCode.options.length, 249);
  for (const countryCode of PublishPostBody.shape.recordingLocation.unwrap().shape.countryCode.options) {
    assert.equal(validateRecordingLocation({...location, countryCode}, now)?.countryCode, countryCode);
  }
  assert.equal(validateRecordingLocation(undefined, now), null);
  assert.equal(validateRecordingLocation(location, now)?.recordedAt.toISOString(), "2025-12-31T22:00:00.000Z");
  assert.ok(validateRecordingLocation({...location, recordedAt: "2026-01-01T12:05:00Z"}, now));
  for (const value of [
    null, {...location, countryCode: "ZZ"}, {...location, countryCode: "UK"},
    {...location, countryCode: "XK"}, {...location, countryCode: "us"},
    {...location, latitude: 1}, {...location, longitude: 1}, {...location, coordinates: [1, 2]},
    {countryCode: "US"}, {recordedAt: location.recordedAt},
    ...["invalid", "2025-02-29T12:00:00Z", "2025-04-31T12:00:00Z", "2025-13-01T00:00:00Z",
      "2025-12-31", "2025-12-31T12:00:00", "2026-01-01T12:05:00.001Z", 0, null]
      .map((recordedAt) => ({...location, recordedAt})),
  ]) rejects(400, () => validateRecordingLocation(value, now));
});

for (const kind of ["photo", "video"] as const) {
test(`HTTP ${kind} contract: auth, strict validation, recording metadata, deletion and immutable retries`, async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const ticket = {
    id, ownerId: "owner", kind, contentType: kind === "photo" ? "image/png" : "video/mp4", size: 8,
    expiresAt: new Date(Date.now() + 60000), finalizedAt: null as Date | null,
  };
  let stored: Record<string, unknown> | undefined;
  let finalizeCount = 0, removeCount = 0;
  const fakeDb = {
    select: () => ({
      from: (table: unknown) => ({
        orderBy: async () => stored ? [stored] : [],
        where: () => {
          const rows = table === postUploads ? [ticket] : stored ? [stored] : [];
          return Object.assign(Promise.resolve(rows), {for: () => Promise.resolve(rows), orderBy: () => Promise.resolve(rows)});
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
    mediaUrl: async () => {throw new Error("Unexpected storage access");},
    fetchMedia: fetch,
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
    assert.equal((await call("/posts/following", "GET")).status, 401);
    assert.equal((await call("/posts", "GET", "forged")).status, 401);
    assert.equal((await call("/posts/uploads", "POST", "owner", {contentType: "image/svg+xml", kind: "photo", size: 8})).status, 400);
    assert.equal((await call("/posts/uploads", "POST", "owner", {contentType: "image/png", kind: "photo", size: 8, ownerId: "other"})).status, 400);
    assert.equal((await call("/posts", "POST", "other", {uploadId: id, caption: "caption"})).status, 404);
    const recordingLocation = {countryCode: "AX", recordedAt: "2025-01-01T12:00:00.000Z"};
    for (const invalid of [
      {...recordingLocation, countryCode: "ZZ"}, {...recordingLocation, countryCode: "us"},
      {...recordingLocation, recordedAt: "2025-02-30T00:00:00Z"},
      {...recordingLocation, recordedAt: new Date(Date.now() + 600000).toISOString()},
      {...recordingLocation, recordedAt: 0}, {...recordingLocation, recordedAt: "2025-01-01"},
      {...recordingLocation, coordinates: [0, 0]}, {...recordingLocation, latitude: 0},
      {...recordingLocation, longitude: 0}, null,
    ]) {
      assert.equal((await call("/posts", "POST", "owner", {uploadId: id, caption: "caption", recordingLocation: invalid})).status, 400);
    }
    if (kind === "photo") {
      assert.equal((await call("/posts", "POST", "owner", {uploadId: id, caption: "caption", recordingLocation})).status, 400);
    }
    assert.equal(finalizeCount, 0, "invalid metadata must not finalize media");
    const first = await call("/posts", "POST", "owner", {uploadId: id, caption: "caption", ...(kind === "video" ? {recordingLocation} : {})});
    assert.equal(first.status, 200);
    const firstPost = await first.json() as {authorName: string; mediaUrl: string; recordingLocation: unknown};
    assert.equal(firstPost.authorName, "Nino Display Name");
    assert.equal(firstPost.mediaUrl, `/api/posts/media/${id}`);
    assert.deepEqual(firstPost.recordingLocation, kind === "video" ? recordingLocation : null);
    assert.deepEqual(await (await call("/posts", "GET", "owner")).json(), {posts: [firstPost]});
    assert.deepEqual(await (await call("/posts/mine", "GET", "owner")).json(), {posts: [firstPost]});
    if (kind === "video") {
      const changed = await call("/posts", "POST", "owner", {uploadId: id, caption: "different", recordingLocation: {...recordingLocation, countryCode: "US"}});
      assert.deepEqual(await changed.json(), firstPost, "retry cannot change the original country");
    }
    const retry = await call("/posts", "POST", "owner", {uploadId: id, caption: "different"});
    assert.deepEqual(await retry.json(), firstPost);
    assert.equal(finalizeCount, 1);
    // Rows created before the metadata columns existed serialize as explicit null.
    const original = stored;
    stored = {...stored, countryCode: null, recordedAt: null};
    const legacy = await (await call("/posts", "GET", "owner")).json() as {posts: {recordingLocation: unknown}[]};
    assert.equal(legacy.posts[0].recordingLocation, null);
    if (kind === "video") {
      const legacyRetry = await call("/posts", "POST", "owner", {uploadId: id, caption: "different", recordingLocation});
      assert.equal((await legacyRetry.json() as {recordingLocation: unknown}).recordingLocation, null, "retry cannot add metadata to an existing legacy video");
    }
    stored = original;
    assert.equal((await call(`/posts/${id}`, "DELETE", "other")).status, 404);
    assert.equal(removeCount, 0);
    assert.equal((await call(`/posts/${id}`, "DELETE", "owner")).status, 204);
    assert.equal(removeCount, 1);
    assert.deepEqual(await (await call("/posts", "GET", "owner")).json(), {posts: []}, "shared feed excludes deleted posts, including Discover results");
    assert.equal((await call(`/posts/media/${id}`, "GET")).status, 404);
    assert.equal((await call("/posts", "POST", "owner", {uploadId: id, caption: "resurrect"})).status, 410);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
}

test("media proxy: delayed upstream cancellation is contained and the next request stays healthy", {timeout: 10_000}, async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const bytes = Buffer.from("0123456789abcdef");
  const post = {id, kind: "video", contentType: "video/mp4", size: bytes.length};
  function gate() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {resolve = done;});
    return {promise, resolve};
  }
  let mode = "healthy", found = true, signCount = 0, fetchCount = 0;
  let started = gate(), disconnected = gate();
  const signingRelease = gate();
  const upstream = createServer((req, res) => {
    // Undici also appends identity for Range requests.
    assert.ok(req.headers["accept-encoding"]?.split(",").every((value) => value.trim() === "identity"));
    const range = req.headers.range;
    const match = range?.match(/^bytes=(\d+)-(\d+)$/);
    const start = match ? Number(match[1]) : 0;
    const end = match ? Number(match[2]) : bytes.length - 1;
    const body = bytes.subarray(start, end + 1);
    res.on("close", disconnected.resolve);
    if (mode === "before-headers") { started.resolve(); return; }
    if (mode === "missing") { res.writeHead(404).end(); return; }
    res.writeHead(mode === "bad-status" ? 200 : range ? 206 : 200, {
      "Content-Length": mode === "bad-size" ? bytes.length + 1 : body.length,
      ...(range ? {"Content-Range": mode === "bad-range" ? "bytes 0-1/16" : `bytes ${start}-${end}/${bytes.length}`} : {}),
    });
    if (mode === "during-stream") {
      res.write(body.subarray(0, 4));
      started.resolve();
      return;
    }
    res.end(body);
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const privateUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/private?signature=never-public`;
  const app = express();
  app.use("/api", createPostsRouter({
    db: {select: () => ({from: () => ({where: async () => found ? [post] : []})})},
    mediaUrl: async (_id: string, signal: AbortSignal) => {
      signCount++;
      if (mode === "during-signing") {
        signal.addEventListener("abort", disconnected.resolve, {once: true});
        started.resolve();
        await signingRelease.promise;
      }
      return privateUrl;
    },
    fetchMedia: (...args: Parameters<typeof fetch>) => {fetchCount++; return fetch(...args);},
  } as unknown as Parameters<typeof createPostsRouter>[0]));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const publicUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/posts/media/${id}`;
  async function healthy() {
    mode = "healthy";
    const response = await fetch(publicUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(response.headers.get("location"), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
  try {
    mode = "during-signing";
    const signedClient = request(publicUrl);
    signedClient.on("error", () => {});
    signedClient.end();
    await started.promise;
    signedClient.destroy();
    await disconnected.promise;
    const fetchedBefore = fetchCount;
    signingRelease.resolve();
    // Let the delayed signer resolve even though its caller has disconnected.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fetchCount, fetchedBefore, "cancellation while signing must not start a GET");
    await healthy();
    for (const cancellation of ["before-headers", "during-stream"]) {
      mode = cancellation;
      started = gate();
      disconnected = gate();
      const dataReceived = gate();
      const client = request(publicUrl, (response) => {
        response.on("data", dataReceived.resolve);
        response.on("error", () => {});
      });
      client.on("error", () => {});
      client.end();
      await started.promise;
      if (cancellation === "during-stream") await dataReceived.promise;
      client.destroy();
      // Real upstream socket closure proves AbortController canceled both the
      // pending headers fetch and the already-running response body.
      await disconnected.promise;
      await healthy();
    }
    const range = await fetch(publicUrl, {headers: {Range: "bytes=3-7"}});
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), "bytes 3-7/16");
    assert.equal(await range.text(), "34567");
    const head = await fetch(publicUrl, {method: "HEAD", headers: {Range: "bytes=-4"}});
    assert.equal(head.status, 206);
    assert.equal(head.headers.get("content-length"), "4");
    assert.equal(await head.text(), "");
    const invalid = await fetch(publicUrl, {headers: {Range: "bytes=99-"}});
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get("content-range"), "bytes */16");
    await invalid.text();
    for (const invalidUpstream of ["bad-status", "bad-size", "bad-range"]) {
      mode = invalidUpstream;
      const response = await fetch(publicUrl, {headers: {Range: "bytes=3-7"}});
      assert.equal(response.status, 502);
      assert.equal((await response.text()).includes("signature"), false);
      await healthy();
    }
    mode = "missing";
    const missing = await fetch(publicUrl);
    assert.equal(missing.status, 404);
    await missing.text();
    found = false;
    const signedBefore = signCount;
    const unpublished = await fetch(publicUrl);
    assert.equal(unpublished.status, 404);
    await unpublished.text();
    assert.equal(signCount, signedBefore, "unpublished media must never access storage");
    found = true;
    await healthy();
  } finally {
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([server, upstream].map((item) => new Promise<void>((resolve, reject) => {
      item.close((error) => error ? reject(error) : resolve());
    })));
  }
});