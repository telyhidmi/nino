import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { mediaFile, mediaUrl, type PlaybackFormat } from "./postStorage";
import { PostError, VIDEO_LIMIT } from "./postValidation";

const run = promisify(execFile);
const pending = new Map<string, Promise<{ size: number; contentType: string }>>();
const failures = new Map<string, number>();
const types = { mp4: "video/mp4", webm: "video/webm" };
let activeConversions = 0;

export async function probeVideo(path: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-protocol_whitelist", "file,pipe", "-show_streams", "-show_format", "-of", "json", path,
  ], { timeout: 15_000, maxBuffer: 1024 * 1024 });
  const info = JSON.parse(stdout);
  const video = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
  const duration = Number(info.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0 || duration > 600 ||
      video.width <= 0 || video.height <= 0 || video.width * video.height > 3840 * 2160) {
    throw new PostError(422, "Video cannot be prepared. Use a video up to 10 minutes and 4K resolution.");
  }
  return { duration, codec: video.codec_name as string };
}

// Decode only local files, with bounded time, threads, dimensions and output size.
// No shell interpolation and no remote/media-playlist protocol access.
export async function convertVideo(input: string, output: string, format: PlaybackFormat) {
  const original = await probeVideo(input);
  await run("ffmpeg", [
    "-v", "error", "-nostdin", "-y", "-protocol_whitelist", "file,pipe", "-threads", "2", "-filter_threads", "2", "-i", input,
    "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1", "-sn", "-dn",
    "-vf", "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
    "-r", "30", "-pix_fmt", "yuv420p", "-threads", "2",
    ...(format === "mp4"
      ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "main", "-level", "4.0",
         "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-movflags", "+faststart"]
      : ["-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "4", "-b:v", "1800k",
         "-c:a", "libvorbis", "-ac", "2"]),
    "-fs", String(VIDEO_LIMIT), output,
  ], { timeout: 120_000, maxBuffer: 1024 * 1024 });
  const converted = await probeVideo(output);
  const { size } = await stat(output);
  if (size >= VIDEO_LIMIT || Math.abs(converted.duration - original.duration) > 0.5) {
    throw new PostError(422, "Video is too complex to prepare. Export a smaller H.264 MP4 and try again.");
  }
  return size;
}

async function prepare(id: string, size: number, format: PlaybackFormat) {
  const outputFile = mediaFile(id, true, format);
  try {
    const [metadata] = await outputFile.getMetadata();
    const cachedSize = Number(metadata.size);
    if (metadata.contentType === types[format] && cachedSize > 0 && cachedSize <= VIDEO_LIMIT) {
      return { size: cachedSize, contentType: types[format] };
    }
  } catch (error) {
    if ((error as {code?: number}).code !== 404) throw error;
  }
  // Cached playback must remain available even while conversions occupy all slots.
  if (activeConversions >= 2) throw new PostError(503, "Video preparation is busy. Please retry shortly.");
  activeConversions++;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(tmpdir(), "nino-playback-"));
    const input = join(dir, "source");
    const output = join(dir, `playback.${format}`);
    const signal = AbortSignal.timeout(60_000);
    const response = await fetch(await mediaUrl(id, signal), { signal, redirect: "error", headers: { "Accept-Encoding": "identity" } });
    if (!response.ok || !response.body || response.headers.get("content-length") !== String(size)) {
      await response.body?.cancel();
      throw new PostError(502, "Could not read the original video. Please retry.");
    }
    let received = 0;
    await pipeline(Readable.fromWeb(response.body), new Transform({
      transform(chunk: Buffer, _encoding, done) {
        received += chunk.length;
        done(received > size ? new Error("Video size mismatch") : null, received > size ? undefined : chunk);
      },
      flush(done) { done(received !== size ? new Error("Video size mismatch") : null); },
    }), createWriteStream(input), { signal });
    const convertedSize = await convertVideo(input, output, format);
    // Write a separate, versioned derivative. Never replace the user's original.
    await outputFile.bucket.upload(output, { destination: outputFile.name, metadata: { contentType: types[format] } });
    // A concurrent user deletion must not leave newly-generated media behind.
    const [originalExists] = await mediaFile(id).exists();
    if (!originalExists) {
      await outputFile.delete({ ignoreNotFound: true });
      throw new PostError(404, "Post was deleted");
    }
    return { size: convertedSize, contentType: types[format] };
  } finally {
    activeConversions--;
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}

export function preparePlayback(id: string, size: number, format: PlaybackFormat) {
  const key = `${id}:${format}`;
  const existing = pending.get(key);
  if (existing) return existing;
  for (const [key, until] of failures) if (until <= Date.now()) failures.delete(key);
  if (failures.has(key)) throw new PostError(503, "Video preparation failed. Retry in a minute or upload an H.264 MP4.");
  const job = prepare(id, size, format).catch((error: unknown) => {
    if (error instanceof PostError && error.status === 503) throw error;
    if (failures.size >= 1000) failures.delete(failures.keys().next().value!);
    failures.set(key, Date.now() + 60_000);
    if (error instanceof PostError) throw error;
    // Neither FFmpeg stderr nor fetch/GCS errors (which can contain signed URLs) are public.
    throw new PostError(422, "Video could not be prepared. Try an H.264 MP4 or retry shortly.");
  }).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}
