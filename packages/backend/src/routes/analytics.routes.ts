import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AnalyticsService, PresetRange } from '../services/analytics.service.js';

const analyticsQuerySchema = z.object({
  preset: z
    .enum(['today', 'yesterday', 'week', '15days', 'month', 'last_month', 'year', 'custom'])
    .optional()
    .default('today'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  centerId: z.string().optional(),
});

const updateSettingsSchema = z.object({
  centerId: z.string().optional(),
  isOpen: z.boolean().optional(),
  autoDeleteOnCollection: z.boolean().optional(),
  bwRatePerSheet: z.number().positive().optional(),
  colorRatePerSheet: z.number().positive().optional(),
  a3Multiplier: z.number().positive().optional(),
  paperStockA4: z.number().int().min(0).optional(),
  paperStockA3: z.number().int().min(0).optional(),
});

export const analyticsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/operator/analytics
   * Comprehensive Operator Analytics, Paper Metrics, Hourly Distribution & Collection Ledger
   */
  app.get('/api/v1/operator/analytics', async (req, reply) => {
    const parseResult = analyticsQuerySchema.safeParse(req.query || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { preset, startDate, endDate, centerId } = parseResult.data;
    const analytics = await AnalyticsService.getAnalytics({
      preset: preset as PresetRange,
      startDate,
      endDate,
      centerId,
    });

    return reply.send({
      success: true,
      data: analytics,
    });
  });

  /**
   * GET /api/v1/operator/analytics/export
   * Downloads filtered collection ledger as RFC 4180 CSV
   */
  app.get('/api/v1/operator/analytics/export', async (req, reply) => {
    const parseResult = analyticsQuerySchema.safeParse(req.query || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { preset, startDate, endDate, centerId } = parseResult.data;
    const csvContent = await AnalyticsService.exportAnalyticsCsv({
      preset: preset as PresetRange,
      startDate,
      endDate,
      centerId,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `operator_analytics_${preset}_${timestamp}.csv`;

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csvContent);
  });

  /**
   * POST /api/v1/operator/documents/:id/purge
   * Manually purges physical document file blob for privacy while retaining analytical records
   */
  app.post('/api/v1/operator/documents/:id/purge', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!id) {
      return reply.status(400).send({ error: 'Document ID is required' });
    }

    const result = await AnalyticsService.purgeDocument(id);
    return reply.send(result);
  });

  /**
   * GET /api/v1/operator/settings
   * Retrieves shop open status, privacy auto-delete preference, per-sheet pricing rates, and paper stock
   */
  app.get('/api/v1/operator/settings', async (req, reply) => {
    const { centerId } = (req.query as { centerId?: string }) || {};
    const settings = await AnalyticsService.getShopSettings(centerId);
    return reply.send({
      success: true,
      data: settings,
    });
  });

  /**
   * PATCH /api/v1/operator/settings
   * Updates shop configuration (isOpen, autoDeleteOnCollection, rates, paper stock)
   */
  app.patch('/api/v1/operator/settings', async (req, reply) => {
    const parseResult = updateSettingsSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const { centerId, ...updates } = parseResult.data;
    const updated = await AnalyticsService.updateShopSettings(centerId, updates);

    return reply.send({
      success: true,
      message: 'Shop settings updated successfully',
      data: updated,
    });
  });
};

