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
    async function pair(label: string) {
      const a = `${prefix}-${label}-a`, b = `${prefix}-${label}-b`;
      await register(a,`${label} A`); await register(b,`${label} B`);
      return {a,b,id:(await service.create(a,b)).id};
    }
    const blocked = (error: unknown) => error instanceof MessagingError && error.status === 403;
    await t.test("no follows and each unilateral direction: 0/1/2 sends, retries and first reply unlock", async () => {
      for (const direction of ["none","sender","peer"]) {
        const {a,b,id} = await pair(direction);
        if (direction !== "none") await service.setRelationship(direction === "sender" ? a:b,direction === "sender" ? b:a,true);
        const permission = async (user: string) => (await service.thread(user,id)).conversation.messagingPermission;
        assert.deepEqual(await permission(a),{canSend:true,remainingInitialMessages:2,awaitingReply:false,isMutual:false});
        const nonce = randomUUID(), first = await service.send(a,id,"First initial",nonce);
        assert.equal((await permission(a)).remainingInitialMessages,1);
        await service.send(a,id,"Second initial",randomUUID());
        assert.deepEqual(await permission(a),{canSend:false,remainingInitialMessages:0,awaitingReply:true,isMutual:false});
        await assert.rejects(service.send(a,id,"Third initial",randomUUID()),blocked);
        assert.equal((await service.send(a,id,"First initial",nonce)).id,first.id);
        assert.equal((await permission(a)).remainingInitialMessages,0);
        assert.equal((await permission(b)).remainingInitialMessages,null);
        await service.send(b,id,"First peer reply",randomUUID());
        // Removing either direction cannot revoke the permanent conversation unlock.
        await service.setRelationship(a,b,false); await service.setRelationship(b,a,false);
        for (const user of [a,b]) {
          assert.deepEqual(await permission(user),{canSend:true,remainingInitialMessages:null,awaitingReply:false,isMutual:false});
          for (let i=0;i<3;i++) await service.send(user,id,`Unlocked ${i}`,randomUUID());
        }
        const row = await pool.query("SELECT messaging_unlocked FROM messaging_conversations WHERE id=$1",[id]);
        assert.equal(row.rows[0].messaging_unlocked,true);
      }
    });
    await t.test("mutual followers bypass quota, unfollow before reply restores historical quota, refollow permits reply", async () => {
      const {a,b,id} = await pair("mutual");
      assert.deepEqual(await service.relationship(a,b),{following:false,followsYou:false,mutual:false});
      assert.deepEqual(await service.setRelationship(a,b,true),{following:true,followsYou:false,mutual:false});
      assert.deepEqual(await service.setRelationship(b,a,true),{following:true,followsYou:true,mutual:true});
      await service.setRelationship(a,b,true); // Idempotent PUT-equivalent.
      for (let i=0;i<4;i++) await service.send(a,id,`Mutual ${i}`,randomUUID());
      assert.deepEqual((await service.thread(a,id)).conversation.messagingPermission,
        {canSend:true,remainingInitialMessages:null,awaitingReply:false,isMutual:true});
      await service.setRelationship(b,a,false);
      assert.equal((await service.thread(a,id)).conversation.messagingPermission.remainingInitialMessages,0);
      await assert.rejects(service.send(a,id,"Unfollowed, no reply yet",randomUUID()),blocked);
      await service.setRelationship(b,a,true);
      await service.send(b,id,"Reciprocated message",randomUUID());
      await service.setRelationship(a,b,false); await service.setRelationship(b,a,false);
      await service.send(a,id,"Permanent after unfollow",randomUUID());
      assert.equal((await service.thread(a,id)).conversation.messagingPermission.remainingInitialMessages,null);
      await assert.rejects(service.setRelationship(a,a,true),(error: unknown) => error instanceof MessagingError && error.status === 400);
    });
    await t.test("three simultaneous distinct sends accept only two; simultaneous retries consume one", async () => {
      const {a,b,id} = await pair("race");
      const results = await Promise.allSettled(Array.from({length:3},(_,i) => service.send(a,id,`Raced ${i}`,randomUUID())));
      assert.equal(results.filter((r) => r.status === "fulfilled").length,2);
      const rejected = results.find((r) => r.status === "rejected");
      assert.ok(rejected?.status === "rejected" && blocked(rejected.reason));
      assert.equal((await service.thread(b,id)).messages.length,2);
      const retryPair = await pair("retry-race"), nonce = randomUUID();
      const retries = await Promise.all(Array.from({length:3},() => service.send(retryPair.a,retryPair.id,"Same request",nonce)));
      assert.equal(new Set(retries.map((m) => m.id)).size,1);
      assert.equal((await service.thread(retryPair.a,retryPair.id)).conversation.messagingPermission.remainingInitialMessages,1);
    });
    await t.test("pre-policy message history counts and bidirectional legacy history stays unlocked", async () => {
      const {a,b,id} = await pair("legacy");
      // Represent messages that already existed before this additive migration.
      for (let sequence=1;sequence<=3;sequence++)
        await pool.query(`INSERT INTO messaging_messages(conversation_id,sender_id,client_nonce,text,sequence)
          VALUES($1,$2,$3,'Historical message',$4)`,[id,a,randomUUID(),sequence]);
      await pool.query("UPDATE messaging_conversations SET sequence=3 WHERE id=$1",[id]);
      await assert.rejects(service.send(a,id,"Existing history exhausts quota",randomUUID()),blocked);
      await pool.query(`INSERT INTO messaging_messages(conversation_id,sender_id,client_nonce,text,sequence)
        VALUES($1,$2,$3,'Historical reply',4)`,[id,b,randomUUID()]);
      await pool.query("UPDATE messaging_conversations SET sequence=4 WHERE id=$1",[id]);
      assert.equal((await service.thread(a,id)).conversation.messagingPermission.remainingInitialMessages,null);
      await service.send(a,id,"Legacy remains unlocked",randomUUID());
    });
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
        clerkClient:{
          users:{getUser:async (id: string) => {
            if (!profiles.includes(id)) throw Object.assign(new Error("Missing member"),{status:404});
            return {id,firstName:"Verified",lastName:"Public",username:null,hasImage:false,imageUrl:"",unsafeMetadata:{}};
          }},
        } as unknown as typeof clerkClient, service:async () => service,
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
      async function request(path: string, userId?: string, body?: unknown, method?: string) {
        return fetch(`${base}${path}`,{method:method ?? (body ? "POST":"GET"),
          headers:{"Content-Type":"application/json",...(userId ? {"x-test-member":userId}:{})},
          ...(body ? {body:JSON.stringify(body)}:{})});
      }
      try {
        assert.equal((await request("/conversations")).status,401);
        const relationshipPath = `/people/${bob}/relationship`;
        assert.equal((await request(relationshipPath)).status,401);
        assert.equal((await request(relationshipPath,undefined,{following:true},"PUT")).status,401);
        assert.deepEqual(await (await request(relationshipPath,alice)).json(),{following:false,followsYou:false,mutual:false});
        for (let i=0;i<2;i++)
          assert.deepEqual(await (await request(relationshipPath,alice,{following:true},"PUT")).json(),
            {following:true,followsYou:false,mutual:false});
        assert.deepEqual(await (await request(`/people/${alice}/relationship`,bob)).json(),
          {following:false,followsYou:true,mutual:false});
        assert.equal((await request(relationshipPath,alice,{following:"true"},"PUT")).status,400);
        assert.equal((await request(relationshipPath,alice,{following:true,followerId:bob},"PUT")).status,400);
        assert.equal((await request(`/people/${alice}/relationship`,alice,{following:true},"PUT")).status,400);
        assert.equal((await request("/people/missing-clerk-member/relationship",alice)).status,404);
        assert.equal((await request("/people/missing-clerk-member/relationship",alice,{following:true},"PUT")).status,404);
        const verifiedProfile = await pool.query("SELECT display_name FROM messaging_profiles WHERE id=$1",[bob]);
        assert.equal(verifiedProfile.rows[0].display_name,"Verified Public");
        assert.deepEqual(await (await request(relationshipPath,alice,{following:false},"PUT")).json(),
          {following:false,followsYou:false,mutual:false});
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
        const restricted = await service.create(alice,outsider);
        const restrictedPath = `/conversations/${restricted.id}/messages`;
        const initial = {text:"Initial HTTP request",clientNonce:randomUUID()};
        const initialResponse = await request(restrictedPath,alice,initial);
        assert.equal(initialResponse.status,200);
        const initialMessage = await initialResponse.json();
        assert.equal((await request(restrictedPath,alice,{text:"Second HTTP request",clientNonce:randomUUID()})).status,200);
        const denied = await request(restrictedPath,alice,{text:"Third HTTP request",clientNonce:randomUUID()});
        assert.equal(denied.status,403);
        assert.equal(typeof (await denied.json() as {error:unknown}).error,"string");
        const exhaustedRetry = await request(restrictedPath,alice,initial);
        assert.equal(exhaustedRetry.status,200);
        assert.deepEqual(await exhaustedRetry.json(),initialMessage);
        assert.equal((await request(restrictedPath,outsider,{text:"HTTP peer reply",clientNonce:randomUUID()})).status,200);
        assert.equal((await request(restrictedPath,alice,{text:"HTTP unlocked",clientNonce:randomUUID()})).status,200);
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
    await pool.query("DELETE FROM messaging_follows WHERE follower_id=ANY($1::text[]) OR followed_id=ANY($1::text[])",[profiles]);
    await pool.query("DELETE FROM messaging_profiles WHERE id=ANY($1::text[])",[profiles]);
    await pool.end();
  }
});