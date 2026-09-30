import { createHash } from "node:crypto";
import {
  AccessToken, RoomServiceClient, TrackSource, ParticipantInfo_State, TwirpError,
  type Room, type ParticipantInfo, type VideoGrant,
} from "livekit-server-sdk";
import type { LiveStream, LiveJoin } from "@workspace/api-zod";

const PREFIX = "nino-live-v1-";
export class LiveError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function roomName(ownerId: string): string {
  return PREFIX + createHash("sha256").update(ownerId).digest("hex");
}
export function validRoomId(id: unknown): string {
  if (typeof id !== "string" || !/^nino-live-v1-[a-f0-9]{64}$/.test(id)) {
    throw new LiveError(404, "Broadcast not found");
  }
  return id;
}
export function participantIdentity(userId: string): string {
  return `nino-user:${userId}`;
}
type Metadata = {
  app: "nino"; version: 1; hostId: string; hostName: string;
  title: string; startedAt: string;
};
export function roomMetadata(room: Pick<Room, "name" | "metadata">): Metadata | null {
  if (!room.name.startsWith(PREFIX)) return null;
  try {
    const data = JSON.parse(room.metadata) as Metadata;
    if (data.app !== "nino" || data.version !== 1 ||
        typeof data.hostId !== "string" || !data.hostId ||
        room.name !== roomName(data.hostId) ||
        typeof data.hostName !== "string" || !data.hostName || data.hostName.length > 120 ||
        typeof data.title !== "string" || !data.title.trim() || data.title.length > 120 ||
        typeof data.startedAt !== "string" || !Number.isFinite(Date.parse(data.startedAt))) return null;
    return data;
  } catch { return null; }
}
export function hasBroadcastingHost(metadata: Metadata, participants: ParticipantInfo[]): boolean {
  return participants.some((participant) =>
    participant.identity === participantIdentity(metadata.hostId) &&
    participant.state === ParticipantInfo_State.ACTIVE &&
    participant.tracks.some((track) => track.source === TrackSource.CAMERA && !track.muted));
}
export function serializeStream(room: Pick<Room, "name">, metadata: Metadata, participants: ParticipantInfo[]): LiveStream {
  return {
    id: room.name, title: metadata.title, hostId: metadata.hostId,
    hostName: metadata.hostName, startedAt: new Date(metadata.startedAt),
    viewerCount: participants.filter((participant) =>
      participant.state === ParticipantInfo_State.ACTIVE &&
      participant.identity.startsWith("nino-user:") &&
      participant.identity !== participantIdentity(metadata.hostId)).length,
  };
}
export function participantGrant(room: string, isHost: boolean): VideoGrant {
  return {
    room, roomJoin: true, roomCreate: false, roomList: false,
    roomAdmin: false, roomRecord: false, ingressAdmin: false,
    canPublish: isHost,
    // Setting sources supersedes canPublish, so never give viewers any sources.
    ...(isHost ? {canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE]} : {}),
    canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false,
    canManageAgentSession: false,
  };
}
export function requireLiveOwner(metadata: Metadata, userId: string): void {
  if (metadata.hostId !== userId) throw new LiveError(403, "Only the host can end this broadcast");
}
function isMissing(error: unknown): boolean {
  return error instanceof TwirpError && error.code === "not_found";
}
export type LiveConfig = { serverUrl: string; apiKey: string; apiSecret: string };
export function liveConfig(env: NodeJS.ProcessEnv = process.env): LiveConfig {
  try {
    const serverUrl = env.LIVEKIT_URL?.trim();
    const apiKey = env.LIVEKIT_API_KEY?.trim(), apiSecret = env.LIVEKIT_API_SECRET?.trim();
    if (!serverUrl || !apiKey || !apiSecret) throw new Error();
    const url = new URL(serverUrl);
    if (!["https:", "wss:"].includes(url.protocol) || !url.hostname ||
        url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error();
    url.protocol = "wss:";
    // The SDK validates credentials when creating a signer and API client.
    new AccessToken(apiKey, apiSecret);
    new RoomServiceClient(serverUrl, apiKey, apiSecret);
    return {serverUrl: url.origin, apiKey, apiSecret};
  } catch {
    throw new LiveError(503, "Live broadcasting is not configured correctly");
  }
}
type Rooms = Pick<RoomServiceClient, "listRooms" | "createRoom" | "listParticipants" | "deleteRoom">;
export class LiveService {
  constructor(private config: LiveConfig, private rooms: Rooms = new RoomServiceClient(
    config.serverUrl, config.apiKey, config.apiSecret, {requestTimeout: 10},
  )) {}
  private async participants(id: string): Promise<ParticipantInfo[] | null> {
    try { return await this.rooms.listParticipants(id); }
    catch (error) { if (isMissing(error)) return null; throw error; }
  }
  private async find(id: string) {
    const [room] = await this.rooms.listRooms([validRoomId(id)]);
    const metadata = room && roomMetadata(room);
    if (!room || !metadata) throw new LiveError(404, "Broadcast not found");
    return {room, metadata};
  }
  async list(): Promise<LiveStream[]> {
    const rooms = await this.rooms.listRooms();
    const streams = await Promise.all(rooms.map(async (room) => {
      const metadata = roomMetadata(room);
      if (!metadata) return null;
      const participants = await this.participants(room.name);
      return participants && hasBroadcastingHost(metadata, participants)
        ? serializeStream(room, metadata, participants) : null;
    }));
    return streams.filter((stream): stream is LiveStream => stream !== null)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  async create(userId: string, hostName: string, title: string): Promise<LiveJoin> {
    const id = roomName(userId);
    let [room] = await this.rooms.listRooms([id]);
    if (!room) {
      const metadata: Metadata = {
        app: "nino", version: 1, hostId: userId, hostName: hostName.slice(0, 120),
        title, startedAt: new Date().toISOString(),
      };
      room = await this.rooms.createRoom({
        name: id, metadata: JSON.stringify(metadata), emptyTimeout: 120, departureTimeout: 30,
      });
    }
    const metadata = roomMetadata(room);
    if (!metadata || metadata.hostId !== userId) throw new LiveError(503, "Broadcast room is unavailable");
    const participants = await this.participants(id);
    if (!participants) throw new LiveError(404, "Broadcast expired. Please try again.");
    return this.credentials(room, metadata, participants, userId, hostName);
  }
  async join(id: string, userId: string, name: string): Promise<LiveJoin> {
    const {room, metadata} = await this.find(id);
    const participants = await this.participants(id);
    if (!participants || (userId !== metadata.hostId && !hasBroadcastingHost(metadata, participants))) {
      throw new LiveError(404, "This broadcast is no longer live");
    }
    return this.credentials(room, metadata, participants, userId, name);
  }
  async end(id: string, userId: string): Promise<void> {
    const {metadata} = await this.find(id);
    requireLiveOwner(metadata, userId);
    try { await this.rooms.deleteRoom(id); }
    catch (error) { if (!isMissing(error)) throw error; }
  }
  private async credentials(room: Room, metadata: Metadata, participants: ParticipantInfo[], userId: string, name: string): Promise<LiveJoin> {
    const isHost = userId === metadata.hostId;
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: participantIdentity(userId), name: name.slice(0, 120), ttl: "5m",
    });
    token.addGrant(participantGrant(room.name, isHost));
    return {
      stream: serializeStream(room, metadata, participants), serverUrl: this.config.serverUrl,
      token: await token.toJwt(), isHost,
    };
  }
}

let service: LiveService | undefined;
export function liveService(): LiveService {
  service ??= new LiveService(liveConfig());
  return service;
}