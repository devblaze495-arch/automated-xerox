'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { getOrder } from '@/lib/api';
import { OrderRecord } from '@/lib/types';
import {
  CheckCircle2,
  Clock,
  Printer,
  PackageCheck,
  AlertCircle,
  Copy,
  ArrowLeft,
  RefreshCw,
  FileText,
  ShieldCheck,
  Layers,
  ListOrdered,
  Timer,
} from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll order status every 2 seconds for immediate real-time updates as phone prints
  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      try {
        const data = await getOrder(orderId);
        if (isMounted) {
          setOrder(data);
          setErrorMessage(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to fetch order status');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOrder();
    const interval = setInterval(loadOrder, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const handleCopyOtp = () => {
    if (order?.collectionOtp) {
      navigator.clipboard.writeText(order.collectionOtp);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const steps = [
    { key: 'UPLOADED', label: 'Order Received', desc: 'Order documents uploaded and logged' },
    { key: 'PAYMENT_VERIFIED', label: 'Payment Verified', desc: 'UPI test payment verified and captured' },
    { key: 'QUEUED', label: 'Queued for Dispatch', desc: 'Dispatched to Android companion bridge' },
    { key: 'PRINTING', label: 'Printing Spooled', desc: 'Android spooler dialog opened & printing' },
    { key: 'READY_FOR_COLLECTION', label: 'Ready for Collection', desc: 'Printed and awaiting student OTP' },
    { key: 'COLLECTED', label: 'Order Collected', desc: 'OTP verified & documents handed over' },
  ];

  const getStepStatus = (stepKey: string, currentStatus: string) => {
    const statusOrder = [
      'UPLOADED',
      'PAYMENT_PENDING',
      'PAYMENT_VERIFIED',
      'QUEUED',
      'PRINTING',
      'READY_FOR_COLLECTION',
      'COLLECTED',
      'COMPLETED',
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepKey);

    if (currentStatus === 'COLLECTED' || currentStatus === 'COMPLETED') return 'completed';
    if (currentIndex >= stepIndex) return 'completed';
    if (currentIndex === stepIndex - 1) return 'current';
    return 'pending';
  };

  const getQueuePositionBadge = () => {
    if (!order) return null;

    if (order.status === 'COLLECTED' || order.status === 'COMPLETED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Order Fulfilled
        </span>
      );
    }

    if (order.status === 'READY_FOR_COLLECTION') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold flex items-center gap-1 animate-pulse">
          <PackageCheck className="h-3.5 w-3.5" />
          Ready at Counter!
        </span>
      );
    }

    if (order.status === 'PRINTING') {
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono font-semibold flex items-center gap-1 animate-pulse">
          <Printer className="h-3.5 w-3.5" />
          Printing in Progress
        </span>
      );
    }

    const pos = order.queuePosition !== undefined ? order.queuePosition : 1;
    const wait = order.estimatedWaitMinutes !== undefined ? order.estimatedWaitMinutes : 2;

    return (
      <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 font-mono font-semibold flex items-center gap-1">
        <ListOrdered className="h-3.5 w-3.5" />
        Queue Position: #{pos} (~{wait} min wait)
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Print Ordering
        </Link>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin text-brand-400" />
            <p className="text-sm text-slate-400">Loading live order status...</p>
          </div>
        ) : errorMessage ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <h2 className="text-base font-bold text-white">Order Not Found</h2>
            <p className="text-xs text-rose-300">{errorMessage}</p>
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* 4-Digit Collection OTP Hero Card */}
            <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-surface-card to-surface-card p-6 sm:p-8 text-center shadow-xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="h-4 w-4" />
                Student Collection Pass
              </span>

              <h1 className="text-sm sm:text-base font-medium text-slate-300 mt-1">
                Show this 4-Digit Collection OTP at the Xerox Counter
              </h1>

              {/* Large 4-Digit OTP Code */}
              <div className="my-5 inline-flex items-center justify-center gap-4 px-8 sm:px-12 py-3.5 rounded-2xl bg-surface-dark border-2 border-emerald-500/50 shadow-inner">
                <span className="font-mono text-4xl sm:text-6xl font-black text-emerald-400 tracking-[0.3em] pl-2">
                  {order.collectionOtp}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOtp}
                  className="rounded-xl p-2.5 text-slate-400 hover:bg-surface-elevated hover:text-white transition-colors"
                  title="Copy OTP"
                >
                  {isCopied ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <Copy className="h-6 w-6" />}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
                <span className="font-mono">Order: #{order.id.substring(0, 8)}</span>
                <span>•</span>
                <span className="font-semibold text-white">{order.totalSheets} Physical Sheets</span>
                <span>•</span>
                <span className="font-bold text-white font-mono">
                  ₹{(order.totalAmountCents / 100).toFixed(2)} Paid
                </span>
                <span>•</span>
                {getQueuePositionBadge()}
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brand-400" />
                  Live Order Lifecycle Stepper
                </h2>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync (Polling every 2s)
                </span>
              </div>

              <div className="relative pl-6 border-l border-surface-border space-y-6">
                {steps.map((step) => {
                  const status = getStepStatus(step.key, order.status);
                  const isDone = status === 'completed';
                  const isCurrent = status === 'current';

                  return (
                    <div key={step.key} className="relative">
                      {/* Step Indicator Dot */}
                      <div
                        className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          isDone
                            ? 'border-emerald-500 bg-emerald-500'
                            : isCurrent
                            ? 'border-brand-500 bg-surface-card animate-pulse'
                            : 'border-surface-border bg-surface-dark'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-semibold ${
                              isDone ? 'text-white' : isCurrent ? 'text-brand-400' : 'text-slate-500'
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-brand-500/20 text-brand-400 border border-brand-500/40">
                              CURRENT STAGE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Configured Items Summary */}
            {order.items && order.items.length > 0 && (
              <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-400" />
                  Configured Documents ({order.items.length})
                </h3>

                <div className="space-y-3">
                  {order.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-surface-dark border border-surface-border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-brand-400" />
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {idx + 1}. {item.document?.fileName || (item as any).documentName || 'Document.pdf'}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {item.colorMode} • {item.paperSize} • {item.duplexMode} • {item.copies} {item.copies === 1 ? 'copy' : 'copies'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-white">
                        {item.computedSheets} sheets
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
