import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { Room, ParticipantInfo, TrackInfo, TrackSource, ParticipantInfo_State, TwirpError } from "livekit-server-sdk";
import { LiveError, LiveService, hasBroadcastingHost, liveConfig, participantGrant, participantIdentity, roomMetadata, roomName } from "./live";
import { createLiveRouter } from "../routes/live";

// Local fixtures only. No configured credentials or service requests in tests.
const config = {serverUrl: "wss://test.invalid", apiKey: "test-key", apiSecret: "test-secret-at-least-32-characters"};
function room(owner = "owner", title = "First title") {
  return new Room({
    name: roomName(owner),
    metadata: JSON.stringify({app: "nino", version: 1, hostId: owner, hostName: "Host", title, startedAt: "2026-01-01T12:00:00.000Z"}),
  });
}
function participant(userId: string, publishing = false) {
  return new ParticipantInfo({
    identity: participantIdentity(userId), state: ParticipantInfo_State.ACTIVE,
    tracks: publishing ? [new TrackInfo({source: TrackSource.CAMERA, muted: false})] : [],
  });
}
function fixture() {
  const rooms = new Map<string, Room>();
  const participants = new Map<string, ParticipantInfo[]>();
  let creates = 0, deletes = 0;
  const service = new LiveService(config, {
    async listRooms(names) { return [...rooms.values()].filter((r) => !names || names.includes(r.name)); },
    async createRoom(options) {
      creates++;
      const existing = rooms.get(options.name);
      if (existing) return existing;
      const created = new Room({name: options.name, metadata: options.metadata});
      rooms.set(created.name, created); participants.set(created.name, []);
      return created;
    },
    async listParticipants(name) {
      if (!rooms.has(name)) throw new TwirpError("Not found", "Gone", 404, "not_found");
      return participants.get(name) ?? [];
    },
    async deleteRoom(name) { deletes++; rooms.delete(name); participants.delete(name); },
  });
  return {service, rooms, participants, counts: () => ({creates, deletes})};
}
function claims(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as {
    sub: string; exp: number; nbf: number; video: Record<string, unknown>;
  };
}
test("host grants restrict media to camera/microphone; viewers only subscribe and chat", () => {
  const host = participantGrant(roomName("owner"), true), viewer = participantGrant(roomName("owner"), false);
  assert.deepEqual(host.canPublishSources, [TrackSource.CAMERA, TrackSource.MICROPHONE]);
  assert.equal(host.canPublish, true);
  assert.equal(viewer.canPublish, false);
  assert.equal(viewer.canPublishSources, undefined);
  for (const grant of [host, viewer]) {
    assert.equal(grant.canSubscribe, true); assert.equal(grant.canPublishData, true);
    assert.equal(grant.roomAdmin, false); assert.equal(grant.roomCreate, false);
    assert.equal(grant.canUpdateOwnMetadata, false); assert.equal(grant.roomList, false);
  }
});
test("owned namespace, connected broadcasting camera, and stale filtering", async () => {
  const {service, rooms, participants} = fixture();
  const active = room(), stale = room("stale"), idle = room("idle"), muted = room("muted");
  const outsider = new Room({name: "another-app", metadata: active.metadata});
  const forged = new Room({name: roomName("forged"), metadata: active.metadata});
  for (const value of [active, stale, idle, muted, outsider, forged]) rooms.set(value.name, value);
  participants.set(active.name, [participant("owner", true), participant("viewer")]);
  participants.set(stale.name, [participant("viewer", true)]);
  participants.set(idle.name, [participant("idle")]);
  const mutedHost = participant("muted", true); mutedHost.tracks[0].muted = true;
  participants.set(muted.name, [mutedHost]);
  const streams = await service.list();
  assert.equal(streams.length, 1); assert.equal(streams[0].id, active.name);
  assert.equal(streams[0].viewerCount, 1);
  assert.equal(roomMetadata(outsider), null); assert.equal(roomMetadata(forged), null);
  const disconnected = participant("owner", true); disconnected.state = ParticipantInfo_State.DISCONNECTED;
  assert.equal(hasBroadcastingHost(roomMetadata(active)!, [disconnected]), false);
  await assert.rejects(service.join(stale.name, "viewer", "Viewer"), (error: unknown) => error instanceof LiveError && error.status === 404);
});
test("server identity, immutable retries, reconnect role, owner-only end", async () => {
  const {service, rooms, participants, counts} = fixture();
  const first = await service.create("owner", "Host", "First title");
  const second = await service.create("owner", "Changed name", "Changed title");
  assert.equal(first.stream.id, second.stream.id); assert.equal(second.stream.title, "First title");
  assert.equal(counts().creates, 1);
  assert.equal(first.isHost, true);
  const hostClaims = claims(first.token);
  assert.equal(hostClaims.sub, participantIdentity("owner"));
  assert.deepEqual(hostClaims.video.canPublishSources, ["camera", "microphone"]);
  assert.ok(hostClaims.exp - hostClaims.nbf <= 300);
  assert.equal((await service.join(first.stream.id, "owner", "Host")).isHost, true);
  participants.set(first.stream.id, [participant("owner", true), participant("viewer")]);
  const viewer = await service.join(first.stream.id, "viewer", "Viewer");
  assert.equal(viewer.isHost, false); assert.equal(claims(viewer.token).video.canPublish, false);
  await assert.rejects(service.end(first.stream.id, "viewer"), (error: unknown) => error instanceof LiveError && error.status === 403);
  assert.equal(counts().deletes, 0); assert.equal(rooms.size, 1);
  await service.end(first.stream.id, "owner"); assert.equal(rooms.size, 0);
  await assert.rejects(service.join(first.stream.id, "owner", "Host"), (error: unknown) => error instanceof LiveError && error.status === 404);
});
test("room disappearance during discovery is skipped, not a failed listing", async () => {
  const active = room();
  const service = new LiveService(config, {
    async listRooms() { return [active]; },
    async listParticipants() { throw new TwirpError("Not found", "Gone", 404, "not_found"); },
    async createRoom() { return active; }, async deleteRoom() {},
  });
  assert.deepEqual(await service.list(), []);
});
test("config errors are explicit and never echo configuration", () => {
  for (const env of [{}, {LIVEKIT_URL: "secret-invalid-value"}, {
    LIVEKIT_URL: "wss://user:password@test.invalid", LIVEKIT_API_KEY: "key", LIVEKIT_API_SECRET: "secret",
  }]) {
    assert.throws(() => liveConfig(env), (error: unknown) =>
      error instanceof LiveError && error.status === 503 && error.message === "Live broadcasting is not configured correctly");
  }
});
test("HTTP contract authenticates every endpoint; rejects identity injection and sanitizes failures", async () => {
  const fixtureState = fixture();
  const clerk = {
    async authenticateRequest(request: Request, options: {acceptsToken: string}) {
      assert.equal(options.acceptsToken, "session_token");
      assert.equal(request.headers.get("cookie"), null);
      const bearer = request.headers.get("authorization");
      return {toAuth: () => ({userId: bearer === "Bearer owner" ? "owner" : bearer === "Bearer viewer" ? "viewer" : null})};
    },
    users: {async getUser() { return {unsafeMetadata: {displayName: "Server profile name"}}; }},
  };
  const app = express(); app.use(express.json());
  app.use("/api", createLiveRouter({
    clerkClient: clerk as unknown as NonNullable<Parameters<typeof createLiveRouter>[0]>["clerkClient"],
    liveService: () => fixtureState.service,
  }));
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;
  const id = roomName("owner");
  async function call(path: string, method: string, bearer?: string, body?: unknown) {
    return fetch(base + path, {method, headers: {
      "Content-Type": "application/json", Cookie: "session=must-not-authorize",
      ...(bearer ? {Authorization: `Bearer ${bearer}`} : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body)});
  }
  try {
    for (const [path, method] of [["/live", "GET"], ["/live", "POST"], [`/live/${id}/join`, "POST"], [`/live/${id}`, "DELETE"]]) {
      for (const token of [undefined, "forged", "machine-token"]) assert.equal((await call(path, method, token)).status, 401);
    }
    for (const body of [{title: " "}, {title: "x".repeat(121)}, {title: "Title", hostId: "viewer"}, {title: "Title", metadata: "{}"}]) {
      assert.equal((await call("/live", "POST", "owner", body)).status, 400);
    }
    const created = await call("/live", "POST", "owner", {title: "Title"});
    assert.equal(created.status, 200); assert.equal(created.headers.get("cache-control"), "no-store");
    const join = await created.json() as {stream: {hostId: string; hostName: string}; isHost: boolean};
    assert.equal(join.stream.hostId, "owner"); assert.equal(join.stream.hostName, "Server profile name");
    assert.equal((await call(`/live/${id}`, "DELETE", "viewer")).status, 403);
    assert.equal((await call(`/live/${id}/join`, "POST", "viewer")).status, 404);
    assert.deepEqual(await (await call("/live", "GET", "viewer")).json(), {streams: []});
    fixtureState.service.list = async () => { throw new Error("sensitive upstream details"); };
    const failure = await call("/live", "GET", "owner");
    assert.equal(failure.status, 503);
    assert.deepEqual(await failure.json(), {error: "Live broadcasting is temporarily unavailable. Please retry."});
    assert.equal((await call(`/live/${id}`, "DELETE", "owner")).status, 204);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});