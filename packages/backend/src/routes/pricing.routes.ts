import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { calculateItemPrice } from '../services/pricing.service.js';

const calculatePricingSchema = z.object({
  pageCount: z.number().int().min(1, 'Page count must be at least 1'),
  pageRange: z.string().optional().default('ALL'),
  colorMode: z.enum(['BW', 'COLOR']).default('BW'),
  paperSize: z.enum(['A4', 'A3']).default('A4'),
  duplexMode: z.enum(['SIMPLEX', 'DUPLEX_LONG', 'DUPLEX_SHORT']).default('SIMPLEX'),
  copies: z.number().int().min(1, 'Copies must be at least 1').default(1),
});

export const pricingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/pricing/calculate', async (req, reply) => {
    const parseResult = calculatePricingSchema.safeParse(req.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.format(),
      });
    }

    const input = parseResult.data;
    const calculation = calculateItemPrice(input);

    return reply.send({
      success: true,
      data: calculation,
    });
  });
};

