import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { DocumentService } from '../services/document.service.js';
import { env } from '../config/env.js';

export const documentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * Multipart PDF Document Upload
   */
  app.post('/api/v1/documents/upload', async (req, reply) => {
    try {
      const fileData = await req.file();

      if (!fileData) {
        return reply.status(400).send({
          error: 'No file uploaded. Please provide a PDF document in multipart form-data with field name "file".',
        });
      }

      const buffer = await fileData.toBuffer();
      const originalFileName = fileData.filename || 'document.pdf';
      const uploaderId = (req.headers['x-user-id'] as string) || '00000000-0000-0000-0000-000000000001';

      // 1. Inspect, validate header, count pages, and persist to local storage
      const inspection = await DocumentService.inspectAndStoreDocument(
        buffer,
        originalFileName,
        uploaderId
      );

      // 2. Persist record in database
      const documentRecord = await DocumentService.recordDocumentInDb(
        inspection,
        originalFileName,
        uploaderId
      );

      // 3. Generate accessible download URL for Android bridge
      const storedFileName = path.basename(inspection.storedFilePath);
      const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${storedFileName}`;

      return reply.status(201).send({
        success: true,
        data: {
          documentId: documentRecord.id,
          fileName: originalFileName,
          pageCount: inspection.pageCount,
          fileSizeBytes: inspection.fileSizeBytes,
          sha256Hash: inspection.sha256Hash,
          downloadUrl,
          createdAt: documentRecord.createdAt,
        },
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: 'Document Upload Failed',
        message: err.message,
      });
    }
  });

  /**
   * Stream / Download PDF Document
   */
  app.get('/api/v1/documents/download/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(env.UPLOAD_STORAGE_ABSOLUTE, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Document file not found' });
    }

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
    return reply.send(stream);
  });
};

