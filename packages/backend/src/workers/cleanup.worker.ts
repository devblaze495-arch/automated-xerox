import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../services/queue.service.js';
import { prisma } from '../db/prisma.js';
import { StorageService } from '../services/storage.service.js';
import { env } from '../config/env.js';

export const CLEANUP_QUEUE_NAME = 'document-purge-cleanup';

let cleanupQueue: Queue | null = null;
let cleanupWorker: Worker | null = null;
let purgeIntervalTimer: NodeJS.Timeout | null = null;

export interface PurgeResult {
  purgedCount: number;
  errorsCount: number;
  purgedDocumentIds: string[];
}

/**
 * Core purge execution logic compliant with Digital Personal Data Protection (DPDP) Act.
 * Purges documents that are:
 * 1. Associated with orders marked COLLECTED, CANCELLED, or REJECTED.
 * 2. OR older than 24 hours from creation date.
 */
export async function runPurgeCycle(): Promise<PurgeResult> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const purgedDocumentIds: string[] = [];
  let errorsCount = 0;

  try {
    const candidateDocs = await prisma.document.findMany({
      where: {
        isPurged: false,
        OR: [
          { createdAt: { lt: twentyFourHoursAgo } },
          {
            orderItems: {
              some: {
                order: {
                  status: { in: ['COLLECTED', 'CANCELLED', 'REJECTED'] },
                },
              },
            },
          },
        ],
      },
      take: 200,
    });

    for (const doc of candidateDocs) {
      try {
        // 1. Delete binary from Cloudflare R2 / S3 / Local storage
        await StorageService.deleteFile(doc.s3Key);

        // 2. Update Document record in PostgreSQL
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            isPurged: true,
            filePath: null,
            purgeAt: new Date(),
          },
        });

        purgedDocumentIds.push(doc.id);

        // 3. DPDP Compliance Audit Log
        console.log(
          `🛡️ [DPDP AUDIT] Permanently purged student document [${doc.id}] (s3Key: ${doc.s3Key}, file: ${doc.fileName}). Zero-retention privacy policy enforced.`
        );
      } catch (docErr: any) {
        errorsCount++;
        console.warn(`Failed to purge document ${doc.id}:`, docErr.message);
      }
    }

    if (candidateDocs.length > 0) {
      console.log(
        `🧹 [File Purge Worker] Completed purge cycle: ${purgedDocumentIds.length} documents purged, ${errorsCount} errors.`
      );
    }
  } catch (err: any) {
    // If DB is offline or mock testing, gracefully log warning
    console.warn('[File Purge Worker] Database query bypassed for cleanup cycle:', err.message);
  }

  return {
    purgedCount: purgedDocumentIds.length,
    errorsCount,
    purgedDocumentIds,
  };
}

/**
 * Initializes the BullMQ recurring cleanup queue worker (every hour).
 * Falls back to in-memory recurring interval if Redis is unavailable.
 */
export async function initCleanupWorker(): Promise<void> {
  const connection = getRedisClient();

  try {
    cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    // Schedule hourly recurring purge job via BullMQ
    await cleanupQueue.add(
      'hourly-purge-job',
      { scheduledAt: Date.now() },
      {
        repeat: {
          every: 60 * 60 * 1000, // Every 1 hour
        },
      }
    );

    cleanupWorker = new Worker(
      CLEANUP_QUEUE_NAME,
      async (job: Job) => {
        console.log(`[File Purge Worker] Executing scheduled BullMQ purge job [${job.id}]...`);
        await runPurgeCycle();
      },
      { connection }
    );

    cleanupWorker.on('failed', (job, err) => {
      console.error(`[File Purge Worker] Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ BullMQ 24-Hour File Purge Worker initialized (Scheduled hourly)');
  } catch (err: any) {
    console.warn('BullMQ cleanup queue scheduling deferred to internal interval:', err.message);
  }

  // Backup in-process timer every 1 hour (and run initial check 10 seconds after boot)
  if (!purgeIntervalTimer) {
    setTimeout(runPurgeCycle, 10000);
    purgeIntervalTimer = setInterval(runPurgeCycle, 60 * 60 * 1000);
  }
}

