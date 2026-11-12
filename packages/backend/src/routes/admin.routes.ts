import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { subscriptionService } from '../services/subscription.service.js';
import { orderStore } from '../services/order.store.js';
import { agentRegistry } from '../ws/agent.registry.js';

interface InMemoryCenter {
  id: string;
  name: string;
  code: string;
  location: string;
  ownerName: string;
  ownerPhone: string;
  upiVpa: string;
  agentSecret: string;
  isOpen: boolean;
  isActive: boolean;
  createdAt: Date;
}

// In-memory fallback registry for dev/testing when DB is offline or mock
const inMemoryCenters: Map<string, InMemoryCenter> = new Map([
  [
    '00000000-0000-0000-0000-000000000002',
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Central Library Print Station',
      code: 'CTR-CAMPUS-01',
      location: 'Central Library, Ground Floor, Block A',
      ownerName: 'Ramesh Sharma',
      ownerPhone: '+91 98765 43210',
      upiVpa: 'campusprint@upi',
      agentSecret: env.AGENT_SECRET,
      isOpen: true,
      isActive: true,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  ],
]);

const createCenterSchema = z.object({
  name: z.string().min(2, 'Center name is required'),
  code: z.string().min(2, 'Center code is required').toUpperCase(),
  location: z.string().min(2, 'Location is required'),
  ownerName: z.string().optional().default('Shop Operator'),
  ownerPhone: z.string().optional().default('+91 98765 00000'),
  upiVpa: z.string().optional().default('campusprint@upi'),
});

const updateSubscriptionSchema = z.object({
  extensionDays: z.number().int().positive().optional().default(30),
  status: z.enum(['ACTIVE', 'EXPIRED', 'INACTIVE']).optional().default('ACTIVE'),
  tier: z.enum(['STARTER_INTRO', 'STARTER_RENEWAL', 'ANNUAL']).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Authentication Hook: validates x-admin-secret header against env.ADMIN_SECRET
  app.addHook('preHandler', async (req, reply) => {
    // Only protect /api/v1/admin/* routes
    if (!req.url.startsWith('/api/v1/admin')) {
      return;
    }

    const providedSecret =
      (req.headers['x-admin-secret'] as string) ||
      (req.query as Record<string, string>)?.adminSecret;

    if (!providedSecret || providedSecret !== env.ADMIN_SECRET) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized: Invalid or missing x-admin-secret header',
      });
    }
  });

  /**
   * GET /api/v1/admin/overview
   * Platform-wide SaaS metrics, revenues, order totals, and shop directory.
   */
  app.get('/api/v1/admin/overview', async (_req, reply) => {
    // 1. Gather Centers
    let centersList: any[] = [];
    try {
      const dbCenters = await prisma.printCenter.findMany({
        orderBy: { createdAt: 'desc' },
      });
      if (dbCenters.length > 0) {
        centersList = dbCenters.map((c) => ({
          id: c.id,
          name: c.name,
          code: `CTR-${c.slug.toUpperCase().substring(0, 20)}`,
          location: c.name,
          ownerName: 'Campus Xerox Partner',
          ownerPhone: '+91 98765 43210',
          upiVpa: 'campusprint@upi',
          agentSecret: env.AGENT_SECRET,
          isOpen: c.isOpen,
          isActive: c.isActive,
          createdAt: c.createdAt,
        }));
      }
    } catch (_err) {}

    // Merge in-memory centers if DB is empty or missing newly onboarded ones
    if (centersList.length === 0) {
      centersList = Array.from(inMemoryCenters.values());
    } else {
      for (const [id, memCenter] of inMemoryCenters.entries()) {
        if (!centersList.some((c) => c.id === id || c.code === memCenter.code)) {
          centersList.push(memCenter);
        }
      }
    }

    // 2. Gather All Orders & Metrics
    const allOrders = orderStore.getAllOrders();
    const totalPrintOrders = allOrders.length;
    const totalPrintRevenueInr = allOrders.reduce((sum, o) => sum + (o.totalAmountCents || 0) / 100, 0);

    // 3. Gather SaaS Revenue & Subscriptions
    const totalSaasRevenueInr = await subscriptionService.getTotalSaasRevenueInr();
    const connectedAgents = agentRegistry.getAllConnectedAgents();

    // Map each center with its subscription status and agent online status
    const enrichedCenters = await Promise.all(
      centersList.map(async (c) => {
        // Link subscription: default userId matching center ID or default student/operator
        const subStatus = await subscriptionService.getSubscriptionStatus(c.id).catch(() => ({
          isSubscribed: true,
          currentPeriodEnd: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
          tier: 'STARTER_INTRO' as const,
          status: 'ACTIVE' as const,
          eligiblePromo: false,
          daysRemaining: 28,
          hasUsedIntroPromo: true,
        }));

        // Check if Windows Background Agent is online
        const activeAgent = connectedAgents.find(
          (a) => a.centerId === c.code || a.centerId === c.id
        );

        // Center order counts
        const centerOrders = allOrders.filter(
          (o) => o.centerId === c.id || o.centerId === c.code
        );

        return {
          ...c,
          subscription: {
            status: subStatus.status,
            tier: subStatus.tier,
            currentPeriodEnd: subStatus.currentPeriodEnd,
            daysRemaining: subStatus.daysRemaining,
            isSubscribed: subStatus.isSubscribed,
          },
          agentStatus: {
            isOnline: !!activeAgent,
            deviceModel: activeAgent?.deviceModel || 'Offline',
            appVersion: activeAgent?.appVersion || 'N/A',
            lastHeartbeat: activeAgent?.lastHeartbeat || null,
          },
          orderCount: centerOrders.length,
          revenueGeneratedInr: centerOrders.reduce((acc, o) => acc + (o.totalAmountCents || 0) / 100, 0),
        };
      })
    );

    const totalActiveCenters = enrichedCenters.filter((c) => c.isActive).length;
    const activeSubscriptions = enrichedCenters.filter((c) => c.subscription.status === 'ACTIVE').length;
    const expiredSubscriptions = enrichedCenters.filter((c) => c.subscription.status !== 'ACTIVE').length;

    return reply.send({
      success: true,
      data: {
        metrics: {
          totalActiveCenters,
          activeSubscriptions,
          expiredSubscriptions,
          totalSaasRevenueInr,
          totalPrintOrders,
          totalPrintRevenueInr,
        },
        centers: enrichedCenters,
      },
    });
  });

  /**
   * POST /api/v1/admin/centers
   * Onboards a new Xerox centre, generates agent secret and Windows agent config.
   */
  app.post('/api/v1/admin/centers', async (req, reply) => {
    const parseResult = createCenterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    const { name, code, location, ownerName, ownerPhone, upiVpa } = parseResult.data;
    const centerId = crypto.randomUUID();
    // Cryptographically secure 32-character hex secret for Windows Background Agent
    const agentSecret = crypto.randomBytes(16).toString('hex');

    const cleanSlug = code.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // 1. Persist to Database if available
    try {
      await prisma.printCenter.create({
        data: {
          id: centerId,
          name,
          slug: cleanSlug,
          isActive: true,
          isOpen: true,
          bwRatePerSheet: 2.0,
          colorRatePerSheet: 10.0,
          a3Multiplier: 2.0,
          paperStockA4: 500,
          paperStockA3: 100,
        },
      });
    } catch (_err) {
      // Non-fatal fallback
    }

    // 2. Persist in memory store
    const newCenter: InMemoryCenter = {
      id: centerId,
      name,
      code,
      location,
      ownerName,
      ownerPhone,
      upiVpa,
      agentSecret,
      isOpen: true,
      isActive: true,
      createdAt: new Date(),
    };
    inMemoryCenters.set(centerId, newCenter);

    // 3. Grant initial 30-day SaaS license for new shop
    await subscriptionService.overrideSubscription(centerId, {
      days: 30,
      status: 'ACTIVE',
      tier: 'STARTER_INTRO',
    });

    // 4. Generate ready-to-copy appsettings.json snippet for Windows Service
    const appsettingsSnippet = {
      CampusPrint: {
        ServerUrl: `${env.PUBLIC_BASE_URL}/api/v1/agent/socket`,
        CenterId: code,
        AgentSecret: agentSecret,
        ReconnectIntervalSeconds: 5,
        LogSpoolerPolling: true,
      },
      Logging: {
        LogLevel: {
          Default: 'Information',
          'Microsoft.Hosting.Lifetime': 'Information',
        },
      },
    };

    return reply.status(201).send({
      success: true,
      message: `Print Center '${name}' (${code}) onboarded successfully!`,
      data: {
        centerId,
        name,
        code,
        location,
        ownerName,
        agentSecret,
        appsettingsSnippet,
        standeeUrl: `/download?center=${encodeURIComponent(code)}`,
        posterUrl: `/operator/poster`,
      },
    });
  });

  /**
   * PATCH /api/v1/admin/centers/:id/subscription
   * Manually extends or overrides a centre's B2B SaaS license.
   */
  app.patch('/api/v1/admin/centers/:id/subscription', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parseResult = updateSubscriptionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid subscription override payload',
        details: parseResult.error.format(),
      });
    }

    const { extensionDays, status, tier } = parseResult.data;

    const updatedSub = await subscriptionService.overrideSubscription(id, {
      days: extensionDays,
      status,
      tier,
    });

    return reply.send({
      success: true,
      message: `License successfully extended by ${extensionDays} days for center ${id}.`,
      data: {
        centerId: id,
        subscription: {
          status: updatedSub.status,
          tier: updatedSub.tier,
          currentPeriodEnd: updatedSub.currentPeriodEnd,
        },
      },
    });
  });
};

