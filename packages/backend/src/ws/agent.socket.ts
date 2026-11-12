import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { agentRegistry } from './agent.registry.js';
import { prisma } from '../db/prisma.js';
import { orderStore } from '../services/order.store.js';

export async function registerAgentWebSocket(app: FastifyInstance) {
  app.get('/api/v1/agent/socket', { websocket: true }, (socket: WebSocket, req) => {
    const connectionId = crypto.randomUUID();

    // 1. Authentication Check: headers or query parameters
    const headers = req.headers;
    const query = req.query as Record<string, string>;

    const centerId = (headers['x-center-id'] as string) || query.centerId || 'CTR-CAMPUS-01';
    const secretToken = (headers['x-agent-secret'] as string) || query.token || '';

    // Validate secret token if configured
    if (env.AGENT_SECRET && secretToken !== env.AGENT_SECRET) {
      console.warn(`🔒 Unauthorized WebSocket connection attempt for Center: ${centerId}`);
      socket.send(
        JSON.stringify({
          type: 'ERROR',
          message: 'Authentication failed: Invalid Agent Secret Token',
          timestamp: Date.now(),
        })
      );
      socket.close(1008, 'Unauthorized Agent Secret');
      return;
    }

    // 2. Register with Registry
    agentRegistry.register(connectionId, centerId, socket);

    // Send welcome confirmation including current spooler state
    socket.send(
      JSON.stringify({
        type: 'REGISTER_ACK',
        centerId,
        isPaused: agentRegistry.isSpoolerPaused(centerId),
        message: 'Campus Print Gateway: Handshake verified. Connected to order queue.',
        timestamp: Date.now(),
      })
    );

    // 3. Inbound Message Handling
    socket.on('message', async (rawBuffer: Buffer) => {
      try {
        const rawText = rawBuffer.toString('utf-8');
        const message = JSON.parse(rawText);

        switch (message.type) {
          case 'DEVICE_REGISTER': {
            const { deviceModel, appVersion } = message;
            agentRegistry.updateDeviceInfo(connectionId, deviceModel, appVersion);

            // Update printer/center status in database if available
            try {
              await prisma.printer.updateMany({
                where: { centerId },
                data: {
                  isOnline: true,
                  lastSeenAt: new Date(),
                },
              });
            } catch (_: any) {}

            socket.send(
              JSON.stringify({
                type: 'REGISTER_ACK',
                centerId,
                message: `Device registered: ${deviceModel} (${appVersion})`,
                timestamp: Date.now(),
              })
            );
            break;
          }

          case 'JOB_STATUS_UPDATE': {
            const { orderItemId, status, errorMessage } = message;
            console.log(`📋 Job Status Update: OrderItem [${orderItemId}] -> ${status} ${errorMessage ? `(${errorMessage})` : ''}`);

            // Update in-memory order store
            try {
              // Find order containing this orderItemId
              const allOrders = orderStore.getAllOrders();
              const matchedOrder = allOrders.find(
                (o) => o.id === orderItemId || o.items.some((i) => i.id === orderItemId)
              );

              if (matchedOrder) {
                const targetStatus = status === 'COMPLETED' ? 'READY_FOR_COLLECTION' : status === 'FAILED' ? 'PRINT_FAILED' : status;
                orderStore.updateStatus(matchedOrder.id, targetStatus, { reason: errorMessage });
                console.log(`🔄 OrderStore: Order [${matchedOrder.id}] transitioned to ${targetStatus}`);
              }
            } catch (storeErr: any) {
              console.warn('Order store update skipped:', storeErr.message);
            }

            try {
              // Update PrintJob in Prisma
              await prisma.printJob.updateMany({
                where: { orderItemId },
                data: {
                  status,
                  errorMessage: errorMessage || null,
                  completedAt: status === 'COMPLETED' ? new Date() : undefined,
                },
              });

              // Update Order status in Prisma
              if (status === 'COMPLETED') {
                const item = await prisma.orderItem.findUnique({
                  where: { id: orderItemId },
                  include: { order: true },
                });
                if (item) {
                  await prisma.order.update({
                    where: { id: item.orderId },
                    data: { status: 'READY_FOR_COLLECTION' },
                  });
                }
              } else if (status === 'PRINTING') {
                const item = await prisma.orderItem.findUnique({
                  where: { id: orderItemId },
                  include: { order: true },
                });
                if (item) {
                  await prisma.order.update({
                    where: { id: item.orderId },
                    data: { status: 'PRINTING' },
                  });
                }
              } else if (status === 'FAILED') {
                const item = await prisma.orderItem.findUnique({
                  where: { id: orderItemId },
                  include: { order: true },
                });
                if (item) {
                  await prisma.order.update({
                    where: { id: item.orderId },
                    data: { status: 'PRINT_FAILED', cancellationReason: errorMessage },
                  });
                }
              }
            } catch (dbErr: any) {
              console.warn(`DB update skipped for job status: ${dbErr.message}`);
            }
            break;
          }

          case 'HEARTBEAT': {
            agentRegistry.updateHeartbeat(connectionId);
            socket.send(
              JSON.stringify({
                type: 'HEARTBEAT_ACK',
                timestamp: Date.now(),
              })
            );
            break;
          }

          default: {
            console.log(`Received unknown message type: ${message.type}`);
          }
        }
      } catch (err: any) {
        console.error('Error handling WebSocket message:', err.message);
      }
    });

    socket.on('close', () => {
      agentRegistry.unregister(connectionId);
    });

    socket.on('error', (err) => {
      console.error(`Socket error on connection [${connectionId}]:`, err.message);
      agentRegistry.unregister(connectionId);
    });
  });
}
