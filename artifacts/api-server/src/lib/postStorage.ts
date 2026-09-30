import { Storage } from "@google-cloud/storage";
import type { File } from "@google-cloud/storage";
import { PostError, validateObject } from "./postValidation";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
// Canonical App Storage template sidecar credentials; no application secrets.
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function location(id: string, published: boolean) {
  // Only server-generated/DB UUIDs can reach storage; never accept object paths.
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new PostError(400, "Invalid media id");
  const dir = process.env.PRIVATE_OBJECT_DIR?.replace(/\/+$/, "");
  if (!dir || !/^\/[^/]+\/.+/.test(dir)) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const [, bucket, ...path] = dir.split("/");
  return {bucket, name: `${path.join("/")}/nino/${published ? "published" : "uploads"}/${id}`};
}

export function mediaFile(id: string, published = true): File {
  const {bucket, name} = location(id, published);
  return storage.bucket(bucket).file(name);
}

export async function uploadUrl(id: string, expiresAt: Date) {
  const {bucket, name} = location(id, false);
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({bucket_name: bucket, object_name: name, method: "PUT", expires_at: expiresAt.toISOString()}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not sign upload URL (${response.status})`);
  const body = await response.json() as {signed_url?: unknown};
  if (typeof body.signed_url !== "string") throw new Error("Storage returned an invalid signed URL");
  return body.signed_url as string;
}

export async function finalizeMedia(id: string, contentType: string, size: number) {
  const file = mediaFile(id, false);
  let metadata;
  try { [metadata] = await file.getMetadata(); }
  catch (error) {
    if ((error as {code?: number}).code === 404) throw new PostError(400, "Media has not been uploaded");
    throw error;
  }
  const actualSize = Number(metadata.size);
  if (metadata.contentType !== contentType || actualSize !== size) throw new PostError(422, "Uploaded media size or type does not match ticket");
  // Pin validation AND copy to the same generation: an unexpired PUT cannot
  // replace bytes after validation or overwrite the published media.
  const source = storage.bucket(file.bucket.name).file(file.name, {generation: metadata.generation});
  const chunks: Buffer[] = [];
  for await (const chunk of source.createReadStream({start: 0, end: Math.min(63, size - 1)})) chunks.push(Buffer.from(chunk));
  validateObject(contentType, size, metadata.contentType, actualSize, Buffer.concat(chunks));
  // A retry after a failed DB commit can replace an unreferenced destination.
  // The caller holds the upload row lock and never copies after finalization.
  await source.copy(mediaFile(id));
}

export async function removeMedia(id: string) {
  await mediaFile(id).delete({ignoreNotFound: true});
}