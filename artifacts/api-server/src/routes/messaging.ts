import { Router, type Request, type Response, type NextFunction } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import {
  GetMessagingProfileResponse, SearchMessagingPeopleQueryParams, SearchMessagingPeopleResponse,
  ListMessagingConversationsQueryParams, ListMessagingConversationsResponse,
  CreateMessagingConversationBody, CreateMessagingConversationResponse,
  ListMessagingMessagesParams, ListMessagingMessagesQueryParams, ListMessagingMessagesResponse,
  SendMessagingMessageBody, SendMessagingMessageResponse, MarkMessagingReadBody, MarkMessagingReadResponse,
  type MessagingProfile,
} from "@workspace/api-zod";
import { MessagingError, messagingService } from "../lib/messaging";

export function messagingSessionUser(req: Request) {
  const auth = getAuth(req, {acceptsToken: "session_token"});
  if (!auth.userId || !auth.sessionId) throw new MessagingError(401,"Sign in to use private messages");
  return auth.userId;
}
// These are public display fields only. Never use an email as a fallback name.
export function publicMessagingProfile(user: {
  id: string; unsafeMetadata?: Record<string, unknown>; firstName: string | null;
  lastName: string | null; username: string | null; hasImage: boolean; imageUrl: string;
}): MessagingProfile {
  const raw = user.unsafeMetadata?.displayName;
  const name = typeof raw === "string" ? raw.trim() : "";
  return {id:user.id, displayName:(name && name.length <= 40 ? name :
    [user.firstName,user.lastName].filter(Boolean).join(" ") || user.username || "Nino member").slice(0,120),
    username:user.username, avatarUrl:user.hasImage ? user.imageUrl : null};
}
export function createMessagingRouter(deps = {clerkClient, service:messagingService, user:messagingSessionUser}) {
  const router = Router();
  // Bounded process-local abuse protection; authentication precedes rate limiting.
  const windows = new Map<string,{since:number; count:number}>();
  function limit(userId: string, action: string, max: number) {
    const key = `${action}:${userId}`, now = Date.now();
    if (windows.size > 10000) {
      for (const [k,v] of windows) if (now-v.since >= 60000) windows.delete(k);
      if (windows.size > 10000 && !windows.has(key)) throw new MessagingError(429,"Please retry shortly");
    }
    let window = windows.get(key);
    if (!window || now-window.since >= 60000) {window={since:now,count:0}; windows.set(key,window);}
    if (++window.count > max) throw new MessagingError(429,"Too many requests. Please retry in a minute");
  }
  async function sync(id: string) {
    const profile = publicMessagingProfile(await deps.clerkClient.users.getUser(id));
    return (await deps.service()).syncProfile(profile);
  }
  function parse<T>(schema: {safeParse: (value: unknown) => {success: boolean; data?: T}}, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) throw new MessagingError(400,"Invalid messaging request");
    return result.data as T;
  }
  router.use("/messaging", (_req,res,next) => {res.set("Cache-Control","no-store"); next();});
  router.get("/messaging/profile", async (req,res) => {
    const userId = deps.user(req); limit(userId,"profile",30);
    res.json(GetMessagingProfileResponse.parse(await sync(userId)));
  });
  router.get("/messaging/people", async (req,res) => {
    const userId = deps.user(req); limit(userId,"search",30);
    const {q} = parse(SearchMessagingPeopleQueryParams,req.query);
    if (q.trim().length < 2) throw new MessagingError(400,"Enter at least two characters");
    const service = await deps.service();
    res.json(SearchMessagingPeopleResponse.parse(await service.search(userId,q.trim())));
  });
  router.get("/messaging/conversations", async (req,res) => {
    const userId = deps.user(req); limit(userId,"inbox",120);
    const {cursor} = parse(ListMessagingConversationsQueryParams,req.query);
    res.json(ListMessagingConversationsResponse.parse(await (await deps.service()).inbox(userId,cursor)));
  });
  router.post("/messaging/conversations", async (req,res) => {
    const userId = deps.user(req); limit(userId,"create",20);
    const {peerId} = parse(CreateMessagingConversationBody.strict(),req.body);
    if (peerId === userId) throw new MessagingError(400,"You cannot message yourself");
    await sync(userId);
    try { await sync(peerId); }
    catch (error) {
      if (typeof error === "object" && error !== null && "status" in error && error.status === 404)
        throw new MessagingError(404,"Member not found");
      throw error;
    }
    res.json(CreateMessagingConversationResponse.parse(await (await deps.service()).create(userId,peerId)));
  });
  router.get("/messaging/conversations/:id/messages", async (req,res) => {
    const userId = deps.user(req); limit(userId,"thread",180);
    const {id} = parse(ListMessagingMessagesParams,req.params);
    const {cursor} = parse(ListMessagingMessagesQueryParams,req.query);
    res.json(ListMessagingMessagesResponse.parse(await (await deps.service()).thread(userId,id,cursor)));
  });
  router.post("/messaging/conversations/:id/messages", async (req,res) => {
    const userId = deps.user(req); limit(userId,"send",60);
    const {id} = parse(ListMessagingMessagesParams,req.params);
    const {text,clientNonce} = parse(SendMessagingMessageBody.strict(),req.body);
    if (!text.trim()) throw new MessagingError(400,"Enter a message (1–2000 characters)");
    res.json(SendMessagingMessageResponse.parse(await (await deps.service()).send(userId,id,text,clientNonce)));
  });
  router.post("/messaging/conversations/:id/read", async (req,res) => {
    const userId = deps.user(req); limit(userId,"read",180);
    const {id} = parse(ListMessagingMessagesParams,req.params);
    const {messageId} = parse(MarkMessagingReadBody.strict(),req.body);
    res.json(MarkMessagingReadResponse.parse(await (await deps.service()).read(userId,id,messageId)));
  });
  router.use((error: unknown,req: Request,res: Response,next: NextFunction) => {
    if (res.destroyed) return;
    if (res.headersSent) {next(new Error("Messaging request failed")); return;}
    if (error instanceof MessagingError) {
      if (error.status === 429) res.set("Retry-After","60");
      res.status(error.status).json({error:error.message}); return;
    }
    req.log?.error({event:"messaging_failure"},"Private messaging request failed");
    res.status(503).json({error:"Private messaging is temporarily unavailable. Please retry."});
  });
  return router;
}
export default createMessagingRouter();