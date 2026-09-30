import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { clerkClient } from "@clerk/express";
import { CreateLiveStreamBody, CreateLiveStreamResponse, JoinLiveStreamResponse, ListLiveStreamsResponse } from "@workspace/api-zod";
import { LiveError, liveService, validRoomId } from "../lib/live";

export function createLiveRouter(dependencies = {clerkClient, liveService}) {
  const router: IRouter = Router();
  async function user(req: Request) {
    const header = req.headers.authorization;
    if (!header || !/^Bearer \S+$/i.test(header)) {
      throw new LiveError(401, "A verified Clerk session bearer token is required");
    }
    try {
      // Mobile bearer only: cookies or machine tokens cannot supply identity.
      const state = await dependencies.clerkClient.authenticateRequest(
        new globalThis.Request("https://nino.invalid/api/live", {headers: {Authorization: header}}),
        {acceptsToken: "session_token"},
      );
      const userId = state.toAuth()?.userId;
      if (!userId) throw new Error();
      return userId;
    } catch { throw new LiveError(401, "A verified Clerk session bearer token is required"); }
  }
  async function displayName(userId: string): Promise<string> {
    const profile = await dependencies.clerkClient.users.getUser(userId);
    const raw = profile.unsafeMetadata?.displayName;
    const name = typeof raw === "string" ? raw.trim() : "";
    // Display-only profile fields never determine host privileges.
    return (name && name.length <= 40 ? name :
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.username || "Nino member").slice(0, 120);
  }
  router.use("/live", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/live", async (req, res) => {
    await user(req);
    res.json(ListLiveStreamsResponse.parse({streams: await dependencies.liveService().list()}));
  });
  router.post("/live", async (req, res) => {
    const userId = await user(req);
    const parsed = CreateLiveStreamBody.strict().safeParse(req.body);
    if (!parsed.success || !parsed.data.title.trim()) throw new LiveError(400, "Enter a broadcast title (1–120 characters)");
    const name = await displayName(userId);
    res.json(CreateLiveStreamResponse.parse(await dependencies.liveService().create(userId, name, parsed.data.title.trim())));
  });
  router.post("/live/:id/join", async (req, res) => {
    const userId = await user(req), id = validRoomId(req.params.id);
    const name = await displayName(userId);
    res.json(JoinLiveStreamResponse.parse(await dependencies.liveService().join(id, userId, name)));
  });
  router.delete("/live/:id", async (req, res) => {
    const userId = await user(req), id = validRoomId(req.params.id);
    await dependencies.liveService().end(id, userId);
    res.status(204).end();
  });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.destroyed) return;
    if (res.headersSent) { next(new Error("Live request failed")); return; }
    if (error instanceof LiveError) { res.status(error.status).json({error: error.message}); return; }
    // Never pass SDK errors, tokens, credentials or service URLs to logs.
    req.log?.error({event: "live_service_failure"}, "Live request failed");
    res.status(503).json({error: "Live broadcasting is temporarily unavailable. Please retry."});
  });
  return router;
}
export default createLiveRouter();