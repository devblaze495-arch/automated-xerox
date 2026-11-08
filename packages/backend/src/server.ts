import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './db/prisma.js';
import { initQueueSystem } from './services/queue.service.js';
import { registerAgentWebSocket } from './ws/agent.socket.js';
import { pricingRoutes } from './routes/pricing.routes.js';
import { documentRoutes } from './routes/documents.routes.js';
import { orderRoutes } from './routes/orders.routes.js';
import { paymentRoutes } from './routes/payments.routes.js';
import { agentRoutes } from './routes/agent.routes.js';

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    disableRequestLogging: env.NODE_ENV === 'production',
  });

  // 1. Plugins
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await server.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max upload
    },
  });

  await server.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB websocket payload
    },
  });

  // 2. Health & Root
  server.get('/health', async () => ({
    status: 'ok',
    service: 'campus-print-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  }));

  // 3. Register WebSocket Gateway for Android Companion App
  await registerAgentWebSocket(server);

  // 4. Register REST Routes
  await server.register(pricingRoutes);
  await server.register(documentRoutes);
  await server.register(orderRoutes);
  await server.register(paymentRoutes);
  await server.register(agentRoutes);

  return server;
}

async function start() {
  const server = await buildServer();

  try {
    // Check Database & Queue connections
    await checkDatabaseConnection();
    initQueueSystem();

    // Listen on configured port & host
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log(`
🚀 ========================================================
   CampusPrint Platform - Backend Service Online
   --------------------------------------------------------
   HTTP API:       http://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}
   Agent Socket:   ws://${env.HOST === '0.0.0.0' ? 'localhost' : env.HOST}:${env.PORT}/api/v1/agent/socket
   Health Check:   http://localhost:${env.PORT}/health
   Test Dispatch:  http://localhost:${env.PORT}/api/v1/agent/test-dispatch
========================================================
    `);
  } catch (err: any) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  }
}

// Start if executed directly
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js')) {
  start();
}
