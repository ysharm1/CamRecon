import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { storageService } from './storage.service';

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

describe('storageService', () => {
  afterEach(() => {
    // Clean up test files
    const testDir = path.join(UPLOADS_DIR, 'test-file-id');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('computeChecksum', () => {
    it('should compute a valid SHA-256 hex string', () => {
      const buffer = Buffer.from('hello world');
      const checksum = storageService.computeChecksum(buffer);

      // SHA-256 of "hello world"
      expect(checksum).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
    });

    it('should produce different checksums for different content', () => {
      const buffer1 = Buffer.from('file content A');
      const buffer2 = Buffer.from('file content B');

      const checksum1 = storageService.computeChecksum(buffer1);
      const checksum2 = storageService.computeChecksum(buffer2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should produce consistent checksums for same content', () => {
      const buffer = Buffer.from('consistent content');
      const checksum1 = storageService.computeChecksum(buffer);
      const checksum2 = storageService.computeChecksum(buffer);

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('storeFile', () => {
    it('should store a file and return the storage key', async () => {
      const buffer = Buffer.from('test file content');
      const storageKey = await storageService.storeFile(
        'test-file-id',
        'document.pdf',
        buffer
      );

      expect(storageKey).toBe('test-file-id/document.pdf');

      // Verify file exists on disk
      const filePath = path.join(UPLOADS_DIR, storageKey);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = await fs.promises.readFile(filePath);
      expect(content.toString()).toBe('test file content');
    });
  });

  describe('getFile', () => {
    it('should retrieve a previously stored file', async () => {
      const buffer = Buffer.from('retrievable content');
      const storageKey = await storageService.storeFile(
        'test-file-id',
        'retrieve.pdf',
        buffer
      );

      const retrieved = await storageService.getFile(storageKey);
      expect(retrieved.toString()).toBe('retrievable content');
    });
  });
});
