import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { AnalyticsService } from '../services/analytics.service.js';

const MOCK_CENTERS = [
  {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'CTR-CAMPUS-01',
    name: 'Central Library Print Station',
    location: 'Central Library, Ground Floor, Block A',
    isOpen: true,
    bwRatePerSheet: 2.0,
    colorRatePerSheet: 10.0,
    a3Multiplier: 2.0,
  },
];

export const centersRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/centers/active
   * Returns all active print centers with pricing and open status.
   * Used by student Android app for the shop selector.
   */
  app.get('/api/v1/centers/active', async (req, reply) => {
    try {
      const dbCenters = await prisma.printCenter.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          isOpen: true,
          bwRatePerSheet: true,
          colorRatePerSheet: true,
          a3Multiplier: true,
          paperStockA4: true,
          paperStockA3: true,
        },
        orderBy: { name: 'asc' },
      });

      if (dbCenters.length > 0) {
        const centers = dbCenters.map((c) => ({
          id: c.id,
          code: `CTR-${c.slug.toUpperCase().substring(0, 20)}`,
          name: c.name,
          location: c.name,
          isOpen: c.isOpen,
          bwRatePerSheet: c.bwRatePerSheet,
          colorRatePerSheet: c.colorRatePerSheet,
          a3Multiplier: c.a3Multiplier,
        }));

        return reply.send({ success: true, total: centers.length, data: centers });
      }
    } catch (_err) {
      // Fall through to mock data
    }

    // Offline / dev fallback
    // Dynamically update isOpen from cached settings
    const settings = await AnalyticsService.getShopSettings().catch(() => null);
    const centers = MOCK_CENTERS.map((c) => ({
      ...c,
      isOpen: settings ? settings.isOpen : c.isOpen,
      bwRatePerSheet: settings ? settings.bwRatePerSheet : c.bwRatePerSheet,
      colorRatePerSheet: settings ? settings.colorRatePerSheet : c.colorRatePerSheet,
    }));

    return reply.send({ success: true, total: centers.length, data: centers });
  });
};
