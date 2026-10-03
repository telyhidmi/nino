import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import express, { type Request } from "express";
import { clerkClient } from "@clerk/express";
import { MessagingService, MessagingError } from "./messaging";
import { createMessagingRouter, messagingSessionUser, publicMessagingProfile } from "../routes/messaging";

test("public projection never falls back to email or returns private Clerk fields", () => {
  const profile = publicMessagingProfile({
    id:"profile-unit",firstName:null,lastName:null,username:null,hasImage:false,imageUrl:"",
    unsafeMetadata:{displayName:"   ",email:"private@example.invalid"},
  });
  assert.deepEqual(profile,{id:"profile-unit",displayName:"Nino member",username:null,avatarUrl:null});
  assert.equal(JSON.stringify(profile).includes("private"),false);
  assert.equal(publicMessagingProfile({
    id:"profile-unit",firstName:"First",lastName:"Last",username:"handle",hasImage:false,imageUrl:"",
    unsafeMetadata:{displayName:" Public Name "},
  }).displayName,"Public Name");
});

test("identity must be a session with both user and session IDs, never a machine token", () => {
  function request(auth: Record<string,unknown>) {
    // Unit-only projection of the branded handler installed by Clerk middleware.
    return {auth:Object.assign(() => auth,{[Symbol.for("@clerk/express.auth")]:true})} as unknown as Request;
  }
  assert.equal(messagingSessionUser(request({tokenType:"session_token",userId:"member",sessionId:"session"})),"member");
  for (const auth of [
    {tokenType:"session_token",userId:null,sessionId:null},
    {tokenType:"session_token",userId:"member",sessionId:null},
    {tokenType:"api_key",userId:"member",sessionId:"session"},
  ]) {
    assert.throws(() => messagingSessionUser(request(auth)), (error: unknown) =>
      error instanceof MessagingError && error.status === 401);
  }
});

test("PostgreSQL private messaging integration", {skip:!process.env.DATABASE_URL}, async (t) => {
  // Development DB only. Unique test-owned IDs and targeted cleanup cannot touch app records.
  const {pool} = await import("@workspace/db");
  const service = new MessagingService(pool), prefix = `messaging-test-${randomUUID()}`;
  const alice = `${prefix}-alice`, bob = `${prefix}-bob`, outsider = `${prefix}-outsider`;
  const profiles = [alice,bob,outsider];
  async function register(id: string, name: string) {
    profiles.push(id);
    await service.syncProfile({id,displayName:name,username:`handle-${id}`,avatarUrl:null});
  }
  try {
    await register(alice,"Alice Public"); await register(bob,"Bob Public"); await register(outsider,"Other Public");
    const conversation = await service.create(alice,bob);
    await t.test("pair deduplication under concurrent reversed creation; self excluded", async () => {
      const values = await Promise.all(Array.from({length:8}, (_,i) => service.create(i%2 ? alice:bob,i%2 ? bob:alice)));
      assert.ok(values.every((value) => value.id === conversation.id));
      await assert.rejects(service.create(alice,alice),(error: unknown) => error instanceof MessagingError && error.status === 400);
      assert.equal((await service.search(alice,"Alice")).some((p) => p.id === alice),false);
      assert.equal((await service.search(alice,"bOB")).some((p) => p.id === bob),true);
      assert.equal((await service.search(alice,"%")).length,0);
      assert.equal((await service.search(alice,"@example.invalid")).length,0);
    });
    await t.test("outsider thread, send and read receive indistinguishable 404s", async () => {
      const visible = await service.send(alice,conversation.id,"Private hello",randomUUID());
      for (const action of [
        () => service.thread(outsider,conversation.id),
        () => service.send(outsider,conversation.id,"Intrusion",randomUUID()),
        () => service.read(outsider,conversation.id,visible.id),
      ]) await assert.rejects(action(),(error: unknown) => error instanceof MessagingError && error.status === 404);
      assert.equal((await service.inbox(outsider)).conversations.length,0);
    });
    await t.test("simultaneous retries deduplicate, nonce conflicts do not reorder or increment unread", async () => {
      const nonce = randomUUID(), before = (await service.inbox(bob)).conversations[0];
      const sent = await Promise.all(Array.from({length:10},() => service.send(alice,conversation.id,"Retry safe",nonce)));
      assert.equal(new Set(sent.map((m) => m.id)).size,1);
      const after = (await service.inbox(bob)).conversations[0];
      assert.equal(after.unreadCount,before.unreadCount+1);
      const retry = await service.send(alice,conversation.id,"Retry safe",nonce);
      assert.equal(retry.id,sent[0].id);
      assert.equal((await service.inbox(bob)).conversations[0].updatedAt,after.updatedAt);
      await assert.rejects(service.send(alice,conversation.id,"Changed",nonce),(error: unknown) =>
        error instanceof MessagingError && error.status === 409);
      const other = await service.create(alice,outsider);
      await assert.rejects(service.send(alice,other.id,"Retry safe",nonce),(error: unknown) =>
        error instanceof MessagingError && error.status === 409);
      // Deduplication key is per sender, not global.
      assert.notEqual((await service.send(bob,conversation.id,"Bob's nonce",nonce)).id,retry.id);
    });
    await t.test("explicit reads are monotonic; concurrent later sends stay unread", async () => {
      const observed = await service.send(alice,conversation.id,"Actually displayed",randomUUID());
      await service.thread(bob,conversation.id);
      assert.ok((await service.inbox(bob)).conversations.find((c) => c.id === conversation.id)!.unreadCount > 0);
      const [read,later] = await Promise.all([
        service.read(bob,conversation.id,observed.id),
        service.send(alice,conversation.id,"Arrived concurrently",randomUUID()),
      ]);
      assert.equal(read.readSequence,observed.sequence);
      const inbox = await service.inbox(bob);
      assert.equal(inbox.conversations.find((c) => c.id === conversation.id)!.unreadCount,1);
      assert.deepEqual(await service.read(bob,conversation.id,observed.id),{readSequence:observed.sequence,unreadCount:1});
      const own = await service.send(bob,conversation.id,"My reply",randomUUID());
      assert.equal((await service.read(bob,conversation.id,own.id)).unreadCount,0);
      const stale = await service.read(bob,conversation.id,later.id);
      assert.equal(stale.readSequence,own.sequence);
      assert.equal(stale.unreadCount,0);
    });
    await t.test("thread pagination has no repeats or skips during newer sends", async () => {
      for (let i=0;i<55;i++) await service.send(alice,conversation.id,`Page message ${i}`,randomUUID());
      const first = await service.thread(bob,conversation.id);
      assert.equal(first.messages.length,50); assert.ok(first.nextCursor);
      assert.ok(first.messages.every((m,i,a) => i===0 || a[i-1].sequence > m.sequence));
      await service.send(alice,conversation.id,"Newest after cursor",randomUUID());
      const second = await service.thread(bob,conversation.id,first.nextCursor!);
      const ids = [...first.messages,...second.messages].map((m) => m.id);
      assert.equal(new Set(ids).size,ids.length);
      assert.equal(second.messages[0].sequence,first.messages.at(-1)!.sequence-1);
      const other = await service.create(bob,outsider);
      await assert.rejects(service.thread(bob,other.id,first.nextCursor!),(error: unknown) =>
        error instanceof MessagingError && error.status === 400);
      await assert.rejects(service.thread(bob,conversation.id,"malformed"),(error: unknown) =>
        error instanceof MessagingError && error.status === 400);
    });
    await t.test("inbox stable equal-timestamp cursor and send reorders inbox", async () => {
      for (let i=0;i<33;i++) {
        const id = `${prefix}-peer-${i}`;
        await register(id,`Peer ${i}`); await service.create(alice,id);
      }
      // Fixed millisecond timestamps deliberately exercise the ID tie-breaker.
      await pool.query("UPDATE messaging_conversations SET updated_at='2026-01-01T00:00:00.000Z' WHERE member_low=$1 OR member_high=$1",[alice]);
      const first = await service.inbox(alice);
      assert.equal(first.conversations.length,30); assert.ok(first.nextCursor);
      const second = await service.inbox(alice,first.nextCursor!);
      assert.equal(new Set([...first.conversations,...second.conversations].map((c) => c.id)).size,35);
      await service.send(bob,conversation.id,"Reorder inbox",randomUUID());
      assert.equal((await service.inbox(alice)).conversations[0].id,conversation.id);
    });
    await t.test("HTTP routes enforce authentication, membership, text bounds and rate bounds", async () => {
      const app = express(); app.use(express.json());
      app.use(createMessagingRouter({
        clerkClient, service:async () => service,
        user:(req) => {
          const id = req.headers["x-test-member"];
          if (typeof id !== "string" || ![alice,bob,outsider].includes(id)) throw new MessagingError(401,"Sign in");
          return id;
        },
      }));
      const server = app.listen(0,"127.0.0.1"); await once(server,"listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const base = `http://127.0.0.1:${address.port}/messaging`;
      async function request(path: string, userId?: string, body?: unknown) {
        return fetch(`${base}${path}`,{method:body ? "POST":"GET",
          headers:{"Content-Type":"application/json",...(userId ? {"x-test-member":userId}:{})},
          ...(body ? {body:JSON.stringify(body)}:{})});
      }
      try {
        assert.equal((await request("/conversations")).status,401);
        for (const path of [
          `/conversations/${conversation.id}/messages`,
          `/conversations/${conversation.id}/messages`,
          `/conversations/${conversation.id}/read`,
        ]) {
          const body = path.endsWith("/read") ? {messageId:randomUUID()} :
            path === `/conversations/${conversation.id}/messages` ? {text:"No",clientNonce:randomUUID()}:undefined;
          assert.equal((await request(path,outsider,body)).status,404);
        }
        assert.equal((await request(`/conversations/${conversation.id}/messages`,outsider)).status,404);
        for (const text of ["","   ","x".repeat(2001)]) {
          assert.equal((await request(`/conversations/${conversation.id}/messages`,alice,{text,clientNonce:randomUUID()})).status,400);
        }
        const payload = {text:"HTTP retry",clientNonce:randomUUID()};
        const first = await request(`/conversations/${conversation.id}/messages`,alice,payload);
        const second = await request(`/conversations/${conversation.id}/messages`,alice,payload);
        assert.equal(first.status,200); assert.deepEqual(await first.json(),await second.json());
        for (let i=0;i<30;i++) await request("/people?q=Bob",bob);
        const limited = await request("/people?q=Bob",bob);
        assert.equal(limited.status,429); assert.equal(limited.headers.get("Retry-After"),"60");
        const inbox = await request("/conversations",bob);
        assert.equal(inbox.headers.get("Cache-Control"),"no-store");
      } finally { await new Promise<void>((resolve,reject) => server.close((error) => error ? reject(error):resolve())); }
    });
  } finally {
    // Child tables first; every delete is constrained to IDs created by this test.
    await pool.query(`DELETE FROM messaging_messages WHERE conversation_id IN
      (SELECT id FROM messaging_conversations WHERE member_low=ANY($1::text[]) OR member_high=ANY($1::text[]))`,[profiles]);
    await pool.query("DELETE FROM messaging_conversations WHERE member_low=ANY($1::text[]) OR member_high=ANY($1::text[])",[profiles]);
    await pool.query("DELETE FROM messaging_profiles WHERE id=ANY($1::text[])",[profiles]);
    await pool.end();
  }
});