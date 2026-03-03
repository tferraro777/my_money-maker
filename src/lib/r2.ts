import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getR2Config(): R2Config {
  return {
    accountId: requiredEnv('R2_ACCOUNT_ID'),
    accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    bucket: requiredEnv('R2_BUCKET')
  };
}

function createClient(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120);
}

export function buildStorageKey(userId: string, fileName: string): string {
  const safe = sanitizeFileName(fileName || 'upload.bin');
  return `uploads/${userId}/${Date.now()}-${randomUUID()}-${safe}`;
}

export async function createUploadUrl(input: {
  storageKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const config = getR2Config();
  const client = createClient(config);

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.storageKey,
      ContentType: input.contentType
    }),
    { expiresIn: input.expiresInSeconds ?? 900 }
  );
}

export async function uploadObject(input: {
  storageKey: string;
  contentType: string;
  body: Buffer;
}): Promise<void> {
  const config = getR2Config();
  const client = createClient(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.storageKey,
      ContentType: input.contentType,
      Body: input.body
    })
  );
}

export async function downloadObject(storageKey: string): Promise<Buffer> {
  const config = getR2Config();
  const client = createClient(config);

  const res = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey
    })
  );

  if (!res.Body) {
    throw new Error('R2 object body was empty.');
  }

  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}
