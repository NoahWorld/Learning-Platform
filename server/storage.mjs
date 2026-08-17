import * as Minio from "minio";

export function readStorageConfig(env = process.env) {
  const requiredKeys = ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY"];
  const suppliedKeys = requiredKeys.filter((key) => Boolean(env[key]));

  if (suppliedKeys.length === 0) {
    return null;
  }

  const missingKeys = requiredKeys.filter((key) => !env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`MinIO configuration is incomplete. Missing: ${missingKeys.join(", ")}`);
  }

  const port = Number.parseInt(env.MINIO_PORT ?? "9000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid MINIO_PORT value: ${env.MINIO_PORT}`);
  }

  return {
    endpoint: env.MINIO_ENDPOINT,
    port,
    useSSL: env.MINIO_USE_SSL === "true",
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    bucket: env.MINIO_BUCKET ?? "learning-assets",
  };
}

export function createStorage(env = process.env) {
  const config = readStorageConfig(env);
  if (!config) {
    return null;
  }

  const client = new Minio.Client({
    endPoint: config.endpoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });

  return { client, bucket: config.bucket };
}

export async function ensureBucket(storage) {
  const exists = await storage.client.bucketExists(storage.bucket);
  if (!exists) {
    await storage.client.makeBucket(storage.bucket);
  }
}
