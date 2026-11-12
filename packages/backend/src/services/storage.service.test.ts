import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StorageService } from './storage.service.js';
import { runPurgeCycle } from '../workers/cleanup.worker.js';

describe('Cloud Object Storage & File Purge Tests', () => {
  it('generates presigned upload URL with valid 15-minute expiration and sanitized fileKey', async () => {
    const fileName = 'Student Final Assignment.pdf';
    const mimeType = 'application/pdf';
    const fileSize = 2048576; // ~2MB

    const result = await StorageService.getPresignedUploadUrl(fileName, mimeType, fileSize);

    assert.ok(result.uploadUrl, 'uploadUrl must be present');
    assert.ok(result.fileKey, 'fileKey must be present');
    assert.ok(result.publicUrl, 'publicUrl must be present');
    assert.equal(result.expiresInSeconds, 900, 'Expiration must be exactly 900 seconds (15 minutes)');
    assert.match(result.fileKey, /^docs\//, 'fileKey must start with docs/ prefix');
    assert.ok(result.fileKey.endsWith('.pdf'), 'fileKey must retain .pdf extension');
  });

  it('generates presigned download URL for stored document key', async () => {
    const fileKey = 'docs/sample_test_doc_123.pdf';
    const downloadUrl = await StorageService.getPresignedDownloadUrl(fileKey);

    assert.ok(downloadUrl, 'downloadUrl must be non-empty');
    assert.ok(downloadUrl.includes('sample_test_doc_123.pdf'), 'downloadUrl must reference the target file');
  });

  it('executes DPDP automated file purge cycle without throwing', async () => {
    const result = await runPurgeCycle();

    assert.ok(typeof result.purgedCount === 'number', 'purgedCount must be a number');
    assert.ok(typeof result.errorsCount === 'number', 'errorsCount must be a number');
    assert.ok(Array.isArray(result.purgedDocumentIds), 'purgedDocumentIds must be an array');
  });
});

