import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

/**
 * Local filesystem storage service.
 * In production, this would be replaced with an S3-compatible client.
 */
export const storageService = {
  /**
   * Ensure the uploads directory exists.
   */
  ensureUploadsDir(): void {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  },

  /**
   * Store a file buffer to local filesystem under uploads/{uuid}/{filename}.
   * Returns the storage key (relative path).
   */
  async storeFile(fileId: string, filename: string, buffer: Buffer): Promise<string> {
    this.ensureUploadsDir();

    const dirPath = path.join(UPLOADS_DIR, fileId);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, buffer);

    return `${fileId}/${filename}`;
  },

  /**
   * Retrieve a file from local storage by its storage key.
   */
  async getFile(storageKey: string): Promise<Buffer> {
    const filePath = path.join(UPLOADS_DIR, storageKey);
    return fs.promises.readFile(filePath);
  },

  /**
   * Compute SHA-256 checksum of a buffer.
   */
  computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  },
};
