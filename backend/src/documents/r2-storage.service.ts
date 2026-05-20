/**
 * Cloudflare R2 Storage Service (S3-compatible)
 *
 * Stores documents in R2 when configured, falls back to local filesystem otherwise.
 * R2 is S3-compatible so we use @aws-sdk/client-s3.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'camrecon-documents';
const R2_ENDPOINT = process.env.R2_ENDPOINT;

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT);
}

/**
 * Get the S3 client configured for R2.
 */
function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT!,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Store a file. Uses R2 if configured, local filesystem otherwise.
 * Returns the storage key.
 */
export async function storeFile(fileId: string, filename: string, buffer: Buffer): Promise<string> {
  const storageKey = `${fileId}/${filename}`;

  if (isR2Configured()) {
    const client = getR2Client();
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: getMimeType(filename),
    }));
    return storageKey;
  }

  // Fallback: local filesystem
  const dirPath = path.join(UPLOADS_DIR, fileId);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  await fs.promises.writeFile(path.join(dirPath, filename), buffer);
  return storageKey;
}

/**
 * Retrieve a file by storage key.
 */
export async function getFile(storageKey: string): Promise<Buffer> {
  if (isR2Configured()) {
    const client = getR2Client();
    const response = await client.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    }));
    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }

  // Fallback: local filesystem
  const filePath = path.join(UPLOADS_DIR, storageKey);
  return fs.promises.readFile(filePath);
}

/**
 * Delete a file by storage key.
 */
export async function deleteFile(storageKey: string): Promise<void> {
  if (isR2Configured()) {
    const client = getR2Client();
    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    }));
    return;
  }

  // Fallback: local filesystem
  const filePath = path.join(UPLOADS_DIR, storageKey);
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

/**
 * Compute SHA-256 checksum of a buffer.
 */
export function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Ensure the local uploads directory exists (for fallback mode).
 */
export function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
