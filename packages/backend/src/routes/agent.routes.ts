import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { agentRegistry, DispatchedJobPayload } from '../ws/agent.registry.js';
import { env } from '../config/env.js';

export const agentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * DEV UTILITY: Trigger an immediate mock JOB_DISPATCHED event to any connected Android companion app.
   */
  app.get('/api/v1/agent/test-dispatch', async (req, reply) => {
    const query = req.query as { centerId?: string; copies?: string; color?: string };
    const centerId = query.centerId || 'CTR-CAMPUS-01';

    // Ensure mock PDF exists in storage so the Android app can actually download it
    const mockPdfName = 'campus_test_document.pdf';
    const mockPdfPath = path.join(env.UPLOAD_STORAGE_ABSOLUTE, mockPdfName);

    if (!fs.existsSync(mockPdfPath)) {
      await fs.promises.mkdir(env.UPLOAD_STORAGE_ABSOLUTE, { recursive: true });
      const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 20 Tf
50 780 Td
(CampusPrint Test Dispatch - Order Verified) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000415 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
500
%%EOF`;
      await fs.promises.writeFile(mockPdfPath, samplePdfContent);
    }

    const testOrderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}-ITEM-1`;
    const downloadUrl = `${env.PUBLIC_BASE_URL}/api/v1/documents/download/${mockPdfName}`;

    const testPayload: DispatchedJobPayload = {
      orderItemId: testOrderId,
      documentName: 'Campus_Algorithms_Handout.pdf',
      totalPages: 4,
      colorMode: query.color === 'COLOR' ? 'COLOR' : 'BW',
      duplexMode: 'DUPLEX_LONG',
      paperSize: 'A4',
      copies: query.copies ? parseInt(query.copies, 10) : 2,
      downloadUrl,
      createdAt: Date.now(),
    };

    const dispatched = agentRegistry.dispatchJobToCenter(centerId, testPayload);

    return reply.send({
      success: dispatched,
      message: dispatched
        ? `Successfully dispatched test job [${testOrderId}] to active Android terminal.`
        : `No active Android app connected for center [${centerId}]. Make sure the Android terminal is connected.`,
      dispatchedPayload: testPayload,
      activeAgentsCount: agentRegistry.getAllConnectedAgents().length,
    });
  });

  /**
   * List all currently connected print agents.
   */
  app.get('/api/v1/agent/connected', async (req, reply) => {
    const agents = agentRegistry.getAllConnectedAgents();
    return reply.send({
      success: true,
      totalConnected: agents.length,
      agents,
    });
  });
};

