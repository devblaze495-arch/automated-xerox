import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export class StorageService {
  private static s3Client: S3Client | null = null;

  private static getS3Client(): S3Client | null {
    if (this.s3Client) return this.s3Client;

    if (
      env.STORAGE_DRIVER === 's3' &&
      env.S3_ACCESS_KEY_ID &&
      env.S3_SECRET_ACCESS_KEY
    ) {
      this.s3Client = new S3Client({
        region: env.S3_REGION || 'auto',
        endpoint: env.S3_ENDPOINT || undefined,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: !!env.S3_ENDPOINT, // Required for MinIO / custom R2 endpoints
      });
      return this.s3Client;
    }

    return null;
  }

  /**
   * Generates a presigned upload URL with a 15-minute expiration (900 seconds).
   */
  static async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    fileSize: number
  ): Promise<PresignedUploadResult> {
    const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    const fileKey = `docs/${fileId}_${Date.now()}_${sanitizedName}`;
    const expiresIn = 900; // 15 minutes

    const client = this.getS3Client();

    if (client) {
      const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: fileKey,
        ContentType: mimeType,
        ContentLength: fileSize,
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      const publicUrl = env.S3_ENDPOINT
        ? `${env.S3_ENDPOINT}/${env.S3_BUCKET_NAME}/${fileKey}`
        : `https://${env.S3_BUCKET_NAME}.s3.${env.S3_REGION}.amazonaws.com/${fileKey}`;

      return {
        uploadUrl,
        fileKey,
        publicUrl,
        expiresInSeconds: expiresIn,
      };
    }

    // Local / Dev Fallback: Direct Fastify Presigned Ingress URL
    const localUploadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/upload-presigned/${encodeURIComponent(
      path.basename(fileKey)
    )}`;
    const publicUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${encodeURIComponent(
      path.basename(fileKey)
    )}`;

    return {
      uploadUrl: localUploadUrl,
      fileKey,
      publicUrl,
      expiresInSeconds: expiresIn,
    };
  }

  /**
   * Generates a secure presigned download URL for the Windows agent or PDF viewer.
   */
  static async getPresignedDownloadUrl(fileKey: string): Promise<string> {
    const client = this.getS3Client();

    if (client) {
      const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: fileKey,
      });
      return await getSignedUrl(client, command, { expiresIn: 900 });
    }

    // Local Storage URL
    return `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${encodeURIComponent(
      path.basename(fileKey)
    )}`;
  }

  /**
   * Permanently purges the blob from Cloud Object Storage or local disk.
   */
  static async deleteFile(fileKey: string): Promise<boolean> {
    const client = this.getS3Client();

    if (client) {
      try {
        const command = new DeleteObjectCommand({
          Bucket: env.S3_BUCKET_NAME,
          Key: fileKey,
        });
        await client.send(command);
        return true;
      } catch (err: any) {
        console.warn(`S3 delete failed for key ${fileKey}:`, err.message);
      }
    }

    // Local disk deletion
    try {
      const localFileName = path.basename(fileKey);
      const filePath = path.join(env.UPLOAD_STORAGE_ABSOLUTE, localFileName);
      if (fsSync.existsSync(filePath)) {
        await fs.unlink(filePath);
        return true;
      }
    } catch (err: any) {
      console.warn(`Local file deletion failed for ${fileKey}:`, err.message);
    }

    return false;
  }
}

