import { Client } from "minio";

const isProd = process.env.ENVIRONMENT === "production";

const r2AccountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
const r2Endpoint = `${r2AccountId}.r2.cloudflarestorage.com`;

const minioEndpoint = process.env.MINIO_ENDPOINT ?? "localhost:9000";
const minioHost = minioEndpoint.split(":")[0]!;
const minioPort = parseInt(minioEndpoint.split(":")[1] ?? "9000");

export const storageClient = isProd
  ? new Client({
      endPoint: r2Endpoint,
      useSSL: true,
      region: "auto",
      accessKey: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    })
  : new Client({
      endPoint: minioHost,
      port: minioPort,
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });

export const BUCKET_ASSETS = process.env.MINIO_BUCKET_ASSETS!;
export const BUCKET_VIDEOS = process.env.MINIO_BUCKET_VIDEOS!;

// Presigned URLs are opened by the browser, so they must be signed for the public
// MinIO host (e.g. https://s3.example.com), not the internal docker hostname.
// Fixed region avoids a network round-trip on presign.
const publicUrl = process.env.MINIO_PUBLIC_URL ? new URL(process.env.MINIO_PUBLIC_URL) : null;

export const presignClient = isProd || !publicUrl
  ? storageClient
  : new Client({
      endPoint: publicUrl.hostname,
      port: publicUrl.port ? parseInt(publicUrl.port) : undefined,
      useSSL: publicUrl.protocol === "https:",
      region: "us-east-1",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
