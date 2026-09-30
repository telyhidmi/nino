export const UPLOAD_TTL_MS = 15 * 60 * 1000;
export const PHOTO_LIMIT = 20 * 1024 * 1024;
export const VIDEO_LIMIT = 200 * 1024 * 1024;

export class PostError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function requireOwner(actual: string, expected: string) {
  if (actual !== expected) throw new PostError(404, "Not found");
}

export function requireSessionBearer(header: string | undefined, userId: string | null | undefined) {
  if (!header || !/^Bearer \S+$/i.test(header) || !userId) {
    throw new PostError(401, "A verified Clerk session bearer token is required");
  }
  return userId;
}

export function validateTicket(type: string, size: number, kind: "photo" | "video") {
  if (!type.startsWith(kind === "photo" ? "image/" : "video/")) throw new PostError(400, "Content type does not match media kind");
  if (size > (kind === "photo" ? PHOTO_LIMIT : VIDEO_LIMIT)) throw new PostError(400, "File exceeds media size limit");
}

export function checkFinalize(owner: string, user: string, expiresAt: Date, finalized: boolean, hasPost: boolean) {
  requireOwner(owner, user);
  if (hasPost) return "existing";
  if (finalized) throw new PostError(410, "Post was deleted; request a new upload ticket");
  if (expiresAt.getTime() <= Date.now()) throw new PostError(410, "Upload ticket expired");
  return "publish";
}

// Container signatures are a lightweight safety check, not a full codec decoder.
export function hasMediaSignature(type: string, b: Buffer): boolean {
  const ascii = (start: number, end: number) => b.toString("ascii", start, end);
  switch (type) {
    case "image/jpeg": return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png": return b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    case "image/gif": return ["GIF87a","GIF89a"].includes(ascii(0,6));
    case "image/webp": return ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP";
    case "video/webm": return b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
    case "video/quicktime": return ascii(4,8) === "ftyp" && ascii(8,12) === "qt  ";
    case "video/mp4": return ascii(4,8) === "ftyp" && ["isom","iso2","iso4","iso5","iso6","mp41","mp42","avc1","M4V ","MSNV"].includes(ascii(8,12));
    case "image/heic":
    case "image/heif": return ascii(4,8) === "ftyp" && ["heic","heix","hevc","hevx","mif1","msf1"].includes(ascii(8,12));
    default: return false;
  }
}

export function validateObject(type: string, size: number, actualType: string | undefined, actualSize: number, prefix: Buffer) {
  if (actualType !== type || actualSize !== size || !Number.isSafeInteger(actualSize) || !hasMediaSignature(type, prefix)) {
    throw new PostError(422, "Uploaded media size, content type, or file signature does not match ticket");
  }
}

export function byteRange(header: string | undefined, size: number): {start: number; end: number} | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new PostError(416, "Invalid byte range");
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new PostError(416, "Invalid byte range");
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start < 0 || end < start) throw new PostError(416, "Unsatisfiable byte range");
  return {start, end: Math.min(end, size - 1)};
}