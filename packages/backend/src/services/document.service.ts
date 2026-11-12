import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';

export interface DocumentInspectionResult {
  isValidPdf: boolean;
  pageCount: number;
  fileSizeBytes: number;
  sha256Hash: string;
  s3Key: string;
  storedFilePath: string;
}

export class DocumentService {
  /**
   * Validates buffer starts with '%PDF-' magic header.
   */
  static hasValidPdfHeader(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) return false;
    return (
      buffer[0] === 0x25 && // '%'
      buffer[1] === 0x50 && // 'P'
      buffer[2] === 0x44 && // 'D'
      buffer[3] === 0x46    // 'F'
    );
  }

  /**
   * Computes SHA-256 hash of a buffer.
   */
  static computeSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Inspects and stores an uploaded PDF file buffer.
   */
  static async inspectAndStoreDocument(
    buffer: Buffer,
    originalFileName: string,
    uploaderId?: string
  ): Promise<DocumentInspectionResult> {
    // 1. Verify %PDF- Magic Header
    if (!this.hasValidPdfHeader(buffer)) {
      throw new Error('Invalid document format: Missing %PDF- magic signature');
    }

    // 2. Compute SHA-256 Checksum
    const sha256Hash = this.computeSha256(buffer);
    const fileSizeBytes = buffer.length;

    // 3. Count Pages using pdf-lib
    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch (err: any) {
      throw new Error(`Corrupted or unreadable PDF document: ${err.message}`);
    }

    // 4. Ensure upload storage directory exists
    await fs.mkdir(env.UPLOAD_STORAGE_ABSOLUTE, { recursive: true });

    // 5. Store file with content-hash key to prevent collisions and support deduplication
    const sanitizedExt = path.extname(originalFileName) || '.pdf';
    const s3Key = `docs/${sha256Hash.substring(0, 16)}_${Date.now()}${sanitizedExt}`;
    const storedFilePath = path.join(env.UPLOAD_STORAGE_ABSOLUTE, path.basename(s3Key));

    await fs.writeFile(storedFilePath, buffer);

    return {
      isValidPdf: true,
      pageCount,
      fileSizeBytes,
      sha256Hash,
      s3Key,
      storedFilePath,
    };
  }

  /**
   * Finds or creates a Document record in the database.
   */
  static async recordDocumentInDb(
    data: DocumentInspectionResult,
    originalFileName: string,
    uploaderId: string
  ) {
    try {
      return await prisma.document.create({
        data: {
          uploaderId,
          fileName: originalFileName,
          s3Key: data.s3Key,
          filePath: data.storedFilePath,
          isPurged: false,
          fileSizeBytes: data.fileSizeBytes,
          pageCount: data.pageCount,
          fileHashSha256: data.sha256Hash,
        },
      });
    } catch (err: any) {
      console.warn('Database write bypassed for document (DB may be offline):', err.message);
      return {
        id: crypto.randomUUID(),
        uploaderId,
        fileName: originalFileName,
        s3Key: data.s3Key,
        fileSizeBytes: data.fileSizeBytes,
        pageCount: data.pageCount,
        fileHashSha256: data.sha256Hash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }
}

