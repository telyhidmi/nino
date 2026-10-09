import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import type { AddressInfo } from "node:net";
import { convertVideo, probeVideo } from "./videoPlayback";
import { createPostsRouter } from "../routes/posts";
import { PostError } from "./postValidation";

const run = promisify(execFile);
test("HEVC QuickTime converts to H.264 and VP8 without touching the original; bad streams fail", { timeout: 60_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "nino-video-test-"));
  try {
    const source = join(dir, "qa.mov");
    await run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=15",
      "-f", "lavfi", "-i", "sine=frequency=440", "-t", "2", "-c:v", "libx265", "-x265-params", "pools=1:frame-threads=1", "-tag:v", "hvc1", "-c:a", "aac", source]);
    const hash = async () => createHash("sha256").update(await readFile(source)).digest("hex");
    const before = await hash();
    assert.equal((await probeVideo(source)).codec, "hevc");
    for (const [format, codec] of [["mp4", "h264"], ["webm", "vp8"]] as const) {
      const target = join(dir, `qa.${format}`);
      assert.ok(await convertVideo(source, target, format) > 0);
      const info = await probeVideo(target);
      assert.equal(info.codec, codec);
      assert.ok(Math.abs(info.duration - 2) < 0.2);
      await run("ffmpeg", ["-v", "error", "-i", target, "-f", "null", "-"]);
    }
    assert.equal(await hash(), before);
    const bad = join(dir, "bad.mp4");
    await writeFile(bad, "not video");
    await assert.rejects(probeVideo(bad));
    const audio = join(dir, "audio.m4a");
    await run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine", "-t", "1", audio]);
    await assert.rejects(probeVideo(audio), (error: unknown) => error instanceof PostError && error.status === 422);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("playback route uses derivative byte lengths, validates format, and rechecks deleted posts", async () => {
  const id = "00000000-0000-4000-8000-000000000008";
  let exists = true, deleteDuringConversion = false, prepareCount = 0;
  const bytes = Buffer.from("webm-playback");
  const app = express();
  app.use(createPostsRouter({
    db: {select: () => ({from: () => ({where: async () => exists ? [{id, kind: "video", contentType: "video/quicktime", size: 500}] : []})})},
    mediaUrl: async (_id: string, _signal: AbortSignal, format?: string) => {
      assert.equal(format, "webm"); return "https://storage.invalid/private";
    },
    fetchMedia: async (_url: string, init: RequestInit) => {
      const range = (init.headers as Record<string, string>).Range;
      assert.equal(range, "bytes=0-3");
      return new Response(bytes.subarray(0, 4), {status: 206, headers: {
        "Content-Length": "4", "Content-Range": `bytes 0-3/${bytes.length}`,
      }});
    },
  } as unknown as Parameters<typeof createPostsRouter>[0], async () => {
    prepareCount++;
    if (deleteDuringConversion) exists = false;
    return {size: bytes.length, contentType: "video/webm"};
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/posts/media/${id}`;
  try {
    assert.equal((await fetch(`${url}?playback=other`)).status, 400);
    assert.equal(prepareCount, 0);
    const response = await fetch(`${url}?playback=webm`, {headers: {Range: "bytes=0-3"}});
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-type"), "video/webm");
    assert.equal(response.headers.get("content-range"), `bytes 0-3/${bytes.length}`);
    assert.equal(await response.text(), "webm");
    deleteDuringConversion = true;
    assert.equal((await fetch(`${url}?playback=webm`)).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
