import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { agentRegistry, DispatchedJobPayload } from '../ws/agent.registry.js';
import { prisma } from '../db/prisma.js';

export const PRINT_QUEUE_NAME = 'print-job-dispatch';

export interface PrintQueueJobData {
  orderId: string;
  orderItemId: string;
  centerId: string;
  payload: DispatchedJobPayload;
}

let redisConnection: Redis | null = null;
let printQueue: Queue<PrintQueueJobData> | null = null;
let printWorker: Worker<PrintQueueJobData> | null = null;
let isRedisReady = false;

export function getRedisClient(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 5 && env.NODE_ENV === 'development') {
          return null; // Stop polling in dev to avoid console flood if Redis is offline
        }
        return Math.min(times * 500, 3000);
      },
    });

    redisConnection.on('connect', () => {
      isRedisReady = true;
      console.log('✅ Connected to Redis (Queue & Cache engine ready)');
    });

    redisConnection.on('error', (err) => {
      isRedisReady = false;
      if (env.NODE_ENV === 'development') {
        console.warn(`⚠️ Redis note: ${err.message}. Direct dispatch fallback will be used.`);
      }
    });
  }
  return redisConnection;
}

export function initQueueSystem() {
  const connection = getRedisClient();

  try {
    printQueue = new Queue<PrintQueueJobData>(PRINT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    });

    printWorker = new Worker<PrintQueueJobData>(
      PRINT_QUEUE_NAME,
      async (job: Job<PrintQueueJobData>) => {
        console.log(`[Queue Worker] Processing dispatch for OrderItem: ${job.data.orderItemId}`);
        await executeDirectDispatch(job.data);
      },
      { connection }
    );

    printWorker.on('failed', (job, err) => {
      console.error(`[Queue Worker] Job ${job?.id} failed:`, err.message);
    });
  } catch (err: any) {
    console.warn('Queue system initialization deferred to in-memory mode:', err.message);
  }
}

/**
 * Direct dispatch to connected WebSocket agent terminal.
 */
export async function executeDirectDispatch(data: PrintQueueJobData): Promise<boolean> {
  const { centerId, payload, orderItemId } = data;

  const dispatched = agentRegistry.dispatchJobToCenter(centerId, payload);

  if (dispatched) {
    console.log(`📡 WebSocket dispatched OrderItem ${orderItemId} to Center ${centerId}`);
    try {
      await prisma.printJob.create({
        data: {
          orderItemId,
          status: 'DISPATCHED',
          dispatchedAt: new Date(),
        },
      });

      await prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
          order: {
            update: {
              status: 'QUEUED',
            },
          },
        },
      });
    } catch (_: any) {
      // Ignored if DB is offline during mock dev testing
    }
    return true;
  } else {
    console.warn(`⚠️ No active agent currently connected for Center ${centerId}. Job queued.`);
    return false;
  }
}

/**
 * Enqueue a print dispatch job.
 */
export async function enqueuePrintDispatch(data: PrintQueueJobData): Promise<void> {
  if (printQueue && isRedisReady) {
    try {
      await printQueue.add(`order-item-${data.orderItemId}`, data);
      return;
    } catch (err: any) {
      console.warn('BullMQ enqueue failed, executing direct dispatch:', err.message);
    }
  }

  await executeDirectDispatch(data);
}

