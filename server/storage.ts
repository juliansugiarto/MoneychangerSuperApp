// Object storage helpers backed by Cloudflare R2 (S3-compatible).
// Uploads go directly through the AWS S3 SDK pointed at the R2 endpoint.
// Downloads are served via short-lived presigned GET URLs (no public bucket needed).

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let cachedClient: S3Client | null = null;

function getR2Config() {
  const { r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName } = ENV;

  if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
    throw new Error(
      "Storage config missing: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME",
    );
  }

  return { r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName };
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const { r2AccountId, r2AccessKeyId, r2SecretAccessKey } = getR2Config();

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  return cachedClient;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/**
 * Upload a file to R2. Returns the storage key (persist this in the DB) and
 * a placeholder url — callers should use storageGetSignedUrl(key) for a real,
 * time-limited download link rather than relying on this url field.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { r2BucketName } = getR2Config();
  const key = appendHashSuffix(normalizeKey(relKey));
  const client = getClient();

  const body = typeof data === "string" ? Buffer.from(data, "utf-8") : Buffer.from(data);

  await client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

/**
 * Returns a presigned GET URL valid for a limited time (default 5 minutes).
 * This is what document download endpoints should redirect to.
 */
export async function storageGetSignedUrl(relKey: string, expiresInSeconds = 300): Promise<string> {
  const { r2BucketName } = getR2Config();
  const key = normalizeKey(relKey);
  const client = getClient();

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: r2BucketName, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
