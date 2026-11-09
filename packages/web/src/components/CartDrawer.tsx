'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ShoppingBag, ArrowRight, ShieldCheck, Loader2, Sparkles, FileText } from 'lucide-react';
import { DocumentPrintConfig } from '@/lib/types';
import { createOrder } from '@/lib/api';
import { RazorpayModal } from './RazorpayModal';

interface CartDrawerProps {
  isOpen: boolean;
  configs: DocumentPrintConfig[];
  onClose: () => void;
}

export function CartDrawer({ isOpen, configs, onClose }: CartDrawerProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<{
    orderId: string;
    totalAmountCents: number;
    collectionOtp: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Aggregate totals
  const totalSheets = configs.reduce((sum, c) => sum + (c.pricing?.totalSheets || 0), 0);
  const subtotalCents = configs.reduce((sum, c) => sum + (c.pricing?.itemTotalCents || 0), 0);
  const convenienceFeeCents = configs.length > 0 ? 100 : 0; // ₹1.00 queue fee
  const totalAmountCents = subtotalCents + convenienceFeeCents;

  const handleCheckout = async () => {
    if (configs.length === 0) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const orderPayload = {
        items: configs.map((c) => ({
          documentId: c.document.id,
          pageRange: c.pageRange || 'ALL',
          colorMode: c.colorMode,
          paperSize: c.paperSize,
          duplexMode: c.duplexMode,
          copies: c.copies,
          pageCount: c.document.pageCount,
        })),
      };

      const orderData = await createOrder(orderPayload);

      // Open Razorpay payment simulation modal
      setActivePaymentOrder({
        orderId: orderData.orderId,
        totalAmountCents: orderData.totalAmountCents || totalAmountCents,
        collectionOtp: orderData.collectionOtp,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = (orderId: string) => {
    setActivePaymentOrder(null);
    onClose();
    router.push(`/orders/${orderId}`);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={onClose} />

      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-surface-border bg-surface-card p-6 shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white">Order Summary</h2>
            <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs font-mono font-bold text-brand-400 border border-brand-500/30">
              {configs.length} {configs.length === 1 ? 'doc' : 'docs'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-surface-elevated hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Itemized List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400">
              <FileText className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm font-medium">No documents configured</p>
              <p className="text-xs text-slate-500 mt-1">Upload at least one PDF to review pricing</p>
            </div>
          ) : (
            configs.map((c, i) => (
              <div
                key={c.document.id}
                className="rounded-xl border border-surface-border bg-surface-dark p-3.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                    {i + 1}. {c.document.fileName}
                  </p>
                  <span className="text-xs font-bold font-mono text-white">
                    ₹{((c.pricing?.itemTotalCents || 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border">
                    {c.colorMode}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border">
                    {c.paperSize}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-card border border-surface-border">
                    {c.duplexMode === 'SIMPLEX' ? 'Simplex' : 'Duplex'}
                  </span>
                  <span>•</span>
                  <span>{c.copies} {c.copies === 1 ? 'copy' : 'copies'}</span>
                  <span>•</span>
                  <span>{c.pricing?.totalSheets || 0} sheets</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cost Breakdown Footer */}
        <div className="border-t border-surface-border pt-4 space-y-3">
          <div className="space-y-1.5 text-xs text-slate-300">
            <div className="flex justify-between">
              <span>Total Physical Sheets:</span>
              <span className="font-mono font-medium text-white">{totalSheets} sheets</span>
            </div>
            <div className="flex justify-between">
              <span>Document Printing Subtotal:</span>
              <span className="font-mono font-medium text-white">₹{(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Queue & Platform Fee:</span>
              <span className="font-mono font-medium text-white">₹{(convenienceFeeCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-surface-border">
              <span>Total Payable:</span>
              <span className="text-brand-400 font-mono text-lg">
                ₹{(totalAmountCents / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-400 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting || configs.length === 0}
            className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:bg-surface-elevated disabled:text-slate-500 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-900/30 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing Payment Gateway...
              </>
            ) : (
              <>
                <span>Pay & Submit Order</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Collection OTP issued immediately upon payment
          </p>
        </div>
      </aside>

      {/* Razorpay Test Modal */}
      {activePaymentOrder && (
        <RazorpayModal
          orderId={activePaymentOrder.orderId}
          totalAmountCents={activePaymentOrder.totalAmountCents}
          collectionOtp={activePaymentOrder.collectionOtp}
          onSuccess={handlePaymentSuccess}
          onClose={() => setActivePaymentOrder(null)}
        />
      )}
    </>
  );
}

