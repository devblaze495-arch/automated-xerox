import { prisma } from '../db/prisma.js';
import { printerService, PrinterMatchResult } from './printer.service.js';

export interface EnrichedOrderItem {
  id: string;
  orderId: string;
  documentId: string;
  documentName: string;
  totalPages: number;
  pageRange: string;
  colorMode: 'BW' | 'COLOR';
  paperSize: 'A4' | 'A3';
  duplexMode: 'SIMPLEX' | 'DUPLEX_LONG' | 'DUPLEX_SHORT';
  copies: number;
  computedSheets: number;
  itemTotalCents: number;
  downloadUrl?: string;
  compatiblePrinters?: PrinterMatchResult[];
  assignedPrinterId?: string;
  requiresManualFlip?: boolean;
}

export interface EnrichedOrder {
  id: string;
  studentId: string;
  studentName: string;
  studentPhone: string;
  centerId: string;
  status: string;
  collectionOtp: string;
  totalSheets: number;
  subtotalCents: number;
  convenienceFeeCents: number;
  totalAmountCents: number;
  cancellationReason?: string | null;
  assignedPrinterId?: string | null;
  assignedPrinterName?: string | null;
  assignedPrinterPort?: string | null;
  requiresManualFlip?: boolean;
  isUrgent?: boolean;
  priorityScore?: number;
  createdAt: Date;
  updatedAt: Date;
  items: EnrichedOrderItem[];
  payment?: {
    id?: string;
    rzpOrderId?: string | null;
    rzpPaymentId?: string | null;
    status: string;
    amountCents: number;
  };
}

class OrderStore {
  private orders: Map<string, EnrichedOrder> = new Map();

  constructor() {
    this.seedInitialOrders();
    this.syncFromDatabase().catch(() => {});
  }

  private seedInitialOrders() {
    // Seed sample active orders for instant operator testing
    const sample1: EnrichedOrder = {
      id: '00000000-0000-0000-0000-000000000101',
      studentId: '00000000-0000-0000-0000-000000000001',
      studentName: 'Aarav Sharma',
      studentPhone: '+91 98765 43210',
      centerId: 'CTR-CAMPUS-01',
      status: 'PAYMENT_VERIFIED',
      collectionOtp: '7412',
      totalSheets: 12,
      subtotalCents: 1200,
      convenienceFeeCents: 100,
      totalAmountCents: 1300,
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      items: [
        {
          id: 'item-101',
          orderId: '00000000-0000-0000-0000-000000000101',
          documentId: 'doc-101',
          documentName: 'CS302_Algorithms_Assignment.pdf',
          totalPages: 12,
          pageRange: 'ALL',
          colorMode: 'BW',
          paperSize: 'A4',
          duplexMode: 'DUPLEX_LONG',
          copies: 2,
          computedSheets: 12,
          itemTotalCents: 1200,
        },
      ],
      payment: {
        status: 'CAPTURED',
        amountCents: 1300,
        rzpPaymentId: 'pay_mock_101',
      },
    };

    const sample2: EnrichedOrder = {
      id: '00000000-0000-0000-0000-000000000102',
      studentId: '00000000-0000-0000-0000-000000000001',
      studentName: 'Priya Patel',
      studentPhone: '+91 98765 43211',
      centerId: 'CTR-CAMPUS-01',
      status: 'PRINTING',
      collectionOtp: '3951',
      totalSheets: 12,
      subtotalCents: 3600,
      convenienceFeeCents: 100,
      totalAmountCents: 3700,
      assignedPrinterId: 'prn-g2010',
      assignedPrinterName: 'Canon PIXMA G2010',
      assignedPrinterPort: 'USB001',
      requiresManualFlip: true,
      createdAt: new Date(Date.now() - 12 * 60 * 1000),
      updatedAt: new Date(Date.now() - 3 * 60 * 1000),
      items: [
        {
          id: 'item-102',
          orderId: '00000000-0000-0000-0000-000000000102',
          documentId: 'doc-102',
          documentName: 'Robotics_Lab_Project_Report.pdf',
          totalPages: 24,
          pageRange: 'ALL',
          colorMode: 'COLOR',
          paperSize: 'A4',
          duplexMode: 'DUPLEX_LONG',
          copies: 1,
          computedSheets: 12,
          itemTotalCents: 3600,
          assignedPrinterId: 'prn-g2010',
          requiresManualFlip: true,
        },
      ],
      payment: {
        status: 'CAPTURED',
        amountCents: 3700,
        rzpPaymentId: 'pay_mock_102',
      },
    };

    const sample3: EnrichedOrder = {
      id: '00000000-0000-0000-0000-000000000103',
      studentId: '00000000-0000-0000-0000-000000000001',
      studentName: 'Rahul Verma',
      studentPhone: '+91 98765 43212',
      centerId: 'CTR-CAMPUS-01',
      status: 'READY_FOR_COLLECTION',
      collectionOtp: '8492',
      totalSheets: 8,
      subtotalCents: 800,
      convenienceFeeCents: 100,
      totalAmountCents: 900,
      assignedPrinterId: 'prn-ir2224',
      assignedPrinterName: 'Canon imageRUNNER 2224',
      assignedPrinterPort: 'USB002',
      createdAt: new Date(Date.now() - 25 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 1000),
      items: [
        {
          id: 'item-103',
          orderId: '00000000-0000-0000-0000-000000000103',
          documentId: 'doc-103',
          documentName: 'Engineering_Mechanics_Notes.pdf',
          totalPages: 8,
          pageRange: 'ALL',
          colorMode: 'BW',
          paperSize: 'A4',
          duplexMode: 'SIMPLEX',
          copies: 1,
          computedSheets: 8,
          itemTotalCents: 800,
          assignedPrinterId: 'prn-ir2224',
        },
      ],
      payment: {
        status: 'CAPTURED',
        amountCents: 900,
        rzpPaymentId: 'pay_mock_103',
      },
    };

    this.enrichOrderPrinters(sample1);
    this.enrichOrderPrinters(sample2);
    this.enrichOrderPrinters(sample3);

    this.orders.set(sample1.id, sample1);
    this.orders.set(sample2.id, sample2);
    this.orders.set(sample3.id, sample3);
  }

  private enrichOrderPrinters(order: EnrichedOrder) {
    let orderRequiresManualFlip = false;
    for (const item of order.items) {
      const matches = printerService.findCompatiblePrinters({
        paperSize: item.paperSize,
        colorMode: item.colorMode,
        duplexMode: item.duplexMode,
        copies: item.copies,
      });
      item.compatiblePrinters = matches;
      if (matches.length > 0 && matches[0].requiresManualFlip) {
        item.requiresManualFlip = true;
        orderRequiresManualFlip = true;
      }
    }
    order.requiresManualFlip = orderRequiresManualFlip;
  }

  private async syncFromDatabase() {
    try {
      const dbOrders = await prisma.order.findMany({
        include: {
          items: { include: { document: true } },
          payment: true,
          student: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const dbo of dbOrders) {
        const enriched: EnrichedOrder = {
          id: dbo.id,
          studentId: dbo.studentId,
          studentName: dbo.student?.email?.split('@')[0] || 'Campus Student',
          studentPhone: dbo.student?.phone || '+91 98765 43210',
          centerId: dbo.centerId,
          status: dbo.status,
          collectionOtp: dbo.collectionOtp,
          totalSheets: dbo.totalSheets,
          subtotalCents: dbo.subtotalCents,
          convenienceFeeCents: dbo.convenienceFeeCents,
          totalAmountCents: dbo.totalAmountCents,
          cancellationReason: dbo.cancellationReason,
          isUrgent: (dbo as any).isUrgent ?? false,
          priorityScore: (dbo as any).priorityScore ?? 0,
          createdAt: dbo.createdAt,
          updatedAt: dbo.updatedAt,
          items: dbo.items.map((i) => ({
            id: i.id,
            orderId: i.orderId,
            documentId: i.documentId,
            documentName: i.document?.fileName || 'Document.pdf',
            totalPages: i.document?.pageCount || 1,
            pageRange: i.pageRange,
            colorMode: i.colorMode as any,
            paperSize: i.paperSize as any,
            duplexMode: i.duplexMode as any,
            copies: i.copies,
            computedSheets: i.computedSheets,
            itemTotalCents: i.itemTotalCents,
          })),
          payment: dbo.payment
            ? {
                id: dbo.payment.id,
                rzpOrderId: dbo.payment.rzpOrderId,
                rzpPaymentId: dbo.payment.rzpPaymentId,
                status: dbo.payment.status,
                amountCents: dbo.payment.amountCents,
              }
            : undefined,
        };

        this.enrichOrderPrinters(enriched);
        this.orders.set(dbo.id, enriched);
      }
    } catch (_: any) {}
  }

  public getAllOrders(): EnrichedOrder[] {
    const list = Array.from(this.orders.values());
    for (const o of list) {
      this.enrichOrderPrinters(o);
    }
    return list.sort((a, b) => {
      // 1. Prioritize active orders ahead of terminal states
      const isActiveA =
        a.status === 'PAYMENT_VERIFIED' ||
        a.status === 'WAITING_FOR_OPERATOR' ||
        a.status === 'QUEUED' ||
        a.status === 'PRINTING';
      const isActiveB =
        b.status === 'PAYMENT_VERIFIED' ||
        b.status === 'WAITING_FOR_OPERATOR' ||
        b.status === 'QUEUED' ||
        b.status === 'PRINTING';

      if (isActiveA && isActiveB) {
        // Urgent orders first
        if (!!b.isUrgent !== !!a.isUrgent) {
          return b.isUrgent ? 1 : -1;
        }
        // Higher priorityScore first
        if ((b.priorityScore || 0) !== (a.priorityScore || 0)) {
          return (b.priorityScore || 0) - (a.priorityScore || 0);
        }
        // FIFO by creation time
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (isActiveA && !isActiveB) return -1;
      if (!isActiveA && isActiveB) return 1;

      // Terminal orders sorted newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public setOrderPriority(orderId: string, isUrgent = true, priorityScore?: number): EnrichedOrder | null {
    const order = this.getOrder(orderId);
    if (!order) return null;

    order.isUrgent = isUrgent;
    order.priorityScore = priorityScore ?? (isUrgent ? Math.floor(Date.now() / 1000) : 0);
    order.updatedAt = new Date();
    this.orders.set(order.id, order);

    try {
      prisma.order
        .update({
          where: { id: order.id },
          data: {
            isUrgent: order.isUrgent,
            priorityScore: order.priorityScore,
          },
        })
        .catch(() => {});
    } catch (_err) {}

    return order;
  }

  public getOrder(id: string): EnrichedOrder | undefined {
    let order = this.orders.get(id);
    if (!order) {
      // Also match by prefix if truncated ID passed
      for (const [key, val] of this.orders.entries()) {
        if (key.startsWith(id) || id.startsWith(key)) {
          order = val;
          break;
        }
      }
    }
    if (order) {
      this.enrichOrderPrinters(order);
    }
    return order;
  }

  public saveOrder(order: EnrichedOrder): void {
    this.enrichOrderPrinters(order);
    this.orders.set(order.id, order);
  }

  public updateStatus(
    orderId: string,
    status: string,
    options?: {
      printerId?: string;
      reason?: string;
    }
  ): EnrichedOrder | null {
    const order = this.getOrder(orderId);
    if (!order) return null;

    order.status = status;
    order.updatedAt = new Date();

    if (options?.reason) {
      order.cancellationReason = options.reason;
    }

    if (options?.printerId) {
      const printer = printerService.getPrinterById(options.printerId);
      if (printer) {
        order.assignedPrinterId = printer.id;
        order.assignedPrinterName = printer.name;
        order.assignedPrinterPort = printer.portName;

        // Check if manual flip needed
        const hasDuplex = order.items.some((i) => i.duplexMode !== 'SIMPLEX');
        order.requiresManualFlip = hasDuplex && !printer.capabilities.autoDuplex;
      }
    }

    // Adjust workload
    if (order.assignedPrinterId) {
      if (status === 'QUEUED' || status === 'PRINTING') {
        printerService.updateWorkload(order.assignedPrinterId, 1);
      } else if (status === 'READY_FOR_COLLECTION' || status === 'COLLECTED' || status === 'REJECTED') {
        printerService.updateWorkload(order.assignedPrinterId, -1);
      }
    }

    // Sync to DB
    try {
      prisma.order
        .update({
          where: { id: order.id },
          data: {
            status: status as any,
            cancellationReason: order.cancellationReason,
          },
        })
        .catch(() => {});
    } catch (_: any) {}

    return order;
  }

  /**
   * Calculates live dynamic queue position and estimated wait time for an order.
   */
  public calculateQueuePosition(orderId: string): {
    queuePosition: number;
    estimatedWaitMinutes: number;
    aheadJobsCount: number;
    aheadSheets: number;
  } {
    const targetOrder = this.getOrder(orderId);
    if (!targetOrder) {
      return { queuePosition: 0, estimatedWaitMinutes: 0, aheadJobsCount: 0, aheadSheets: 0 };
    }

    // If order is completed or ready for collection, queue position is 0
    if (
      targetOrder.status === 'READY_FOR_COLLECTION' ||
      targetOrder.status === 'COLLECTED' ||
      targetOrder.status === 'COMPLETED'
    ) {
      return { queuePosition: 0, estimatedWaitMinutes: 0, aheadJobsCount: 0, aheadSheets: 0 };
    }

    if (targetOrder.status === 'PRINTING') {
      return { queuePosition: 1, estimatedWaitMinutes: 1, aheadJobsCount: 0, aheadSheets: 0 };
    }

    // Count preceding active orders taking urgent priority score into account
    const allActive = Array.from(this.orders.values()).filter((o) => {
      if (o.id === targetOrder.id) return false;
      const isActive = o.status === 'QUEUED' || o.status === 'PAYMENT_VERIFIED' || o.status === 'PRINTING';
      if (!isActive) return false;

      // If other is urgent and target is not, other is ahead
      if (o.isUrgent && !targetOrder.isUrgent) return true;
      if (!o.isUrgent && targetOrder.isUrgent) return false;

      // If both urgent, compare priorityScore
      if (o.isUrgent && targetOrder.isUrgent) {
        if ((o.priorityScore || 0) !== (targetOrder.priorityScore || 0)) {
          return (o.priorityScore || 0) > (targetOrder.priorityScore || 0);
        }
      }

      // Otherwise earlier creation is ahead
      return new Date(o.createdAt).getTime() < new Date(targetOrder.createdAt).getTime();
    });

    const aheadJobsCount = allActive.length;
    const aheadSheets = allActive.reduce((sum, o) => sum + (o.totalSheets || 0), 0);
    const queuePosition = aheadJobsCount + 1;
    // Estimate: ~20 sheets per minute plus 1 min buffer
    const estimatedWaitMinutes = Math.max(1, Math.ceil(aheadSheets / 20) + 1);

    return {
      queuePosition,
      estimatedWaitMinutes,
      aheadJobsCount,
      aheadSheets,
    };
  }
}

export const orderStore = new OrderStore();

