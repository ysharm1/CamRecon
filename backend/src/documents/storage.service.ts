/**
 * Storage Service — unified interface.
 * Delegates to R2 (cloud) or local filesystem depending on configuration.
 */

import {
  storeFile,
  getFile,
  deleteFile,
  computeChecksum,
  ensureUploadsDir,
  isR2Configured,
} from './r2-storage.service';

export const storageService = {
  ensureUploadsDir,
  isR2Configured,

  async storeFile(fileId: string, filename: string, buffer: Buffer): Promise<string> {
    return storeFile(fileId, filename, buffer);
  },

  async getFile(storageKey: string): Promise<Buffer> {
    return getFile(storageKey);
  },

  async deleteFile(storageKey: string): Promise<void> {
    return deleteFile(storageKey);
  },

  computeChecksum(buffer: Buffer): string {
    return computeChecksum(buffer);
  },
};
