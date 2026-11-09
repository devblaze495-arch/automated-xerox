'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  CreditCard,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { getOrder, createRazorpayOrder, verifyPayment } from '@/lib/api';
import { OrderRecord } from '@/lib/types';
import Link from 'next/link';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rzpOrderId, setRzpOrderId] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // Load Razorpay Checkout SDK dynamically
  useEffect(() => {
    const existing = document.getElementById('razorpay-sdk');
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setSdkReady(true);
      document.body.appendChild(script);
    } else {
      setSdkReady(true);
    }
  }, []);

  // Fetch Order and create/sync Razorpay Order
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    getOrder(orderId)
      .then(async (fetched) => {
        setOrder(fetched);
        // Create or acquire Razorpay Order ID from backend
        try {
          const rzpData = await createRazorpayOrder(fetched.id, fetched.totalAmountCents);
          setRzpOrderId(rzpData.rzpOrderId);
        } catch (err: any) {
          console.warn('Backend rzp create-order fallback:', err.message);
          setRzpOrderId(`order_mock_${fetched.id.substring(0, 8)}`);
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Order could not be found.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  const handleSimulatePayment = async (status: 'success' | 'failure' = 'success') => {
    if (!order) return;
    setIsProcessing(true);
    setErrorMessage(null);

    if (status === 'failure') {
      setTimeout(() => {
        setErrorMessage('Simulated Payment Declined: Insufficient balance or bank server error.');
        setIsProcessing(false);
      }, 700);
      return;
    }

    try {
      const activeRzpOrderId = rzpOrderId || `order_mock_${Math.floor(100000 + Math.random() * 900000)}`;
      const mockRzpPaymentId = `pay_mock_${Math.floor(100000 + Math.random() * 900000)}`;

      await verifyPayment({
        orderId: order.id,
        rzpOrderId: activeRzpOrderId,
        rzpPaymentId: mockRzpPaymentId,
        rzpSignature: 'mock_signature_verified',
      });

      router.push(`/orders/${order.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment simulation failed');
      setIsProcessing(false);
    }
  };

  const handleLaunchRazorpaySDK = () => {
    if (!order) return;
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      handleSimulatePayment('success');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_campus123',
        amount: order.totalAmountCents,
        currency: 'INR',
        name: 'CampusPrint Centre',
        description: `Order #${order.id.substring(0, 8)}`,
        order_id: rzpOrderId,
        handler: async function (response: any) {
          try {
            await verifyPayment({
              orderId: order.id,
              rzpOrderId: response.razorpay_order_id,
              rzpPaymentId: response.razorpay_payment_id,
              rzpSignature: response.razorpay_signature,
            });
            router.push(`/orders/${order.id}`);
          } catch (err: any) {
            setErrorMessage(err.message || 'Payment verification failed');
            setIsProcessing(false);
          }
        },
        prefill: {
          name: 'Campus Student',
          email: 'student@campus.edu',
          contact: '+919876543210',
        },
        theme: {
          color: '#0284c7',
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', function (resp: any) {
        setErrorMessage(resp.error?.description || 'Payment failed or declined');
        setIsProcessing(false);
      });
      rzpInstance.open();
    } catch (err: any) {
      console.warn('Standard checkout exception fallback:', err.message);
      handleSimulatePayment('success');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-sm text-slate-400">Loading checkout session...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl py-12 px-4 text-center">
        <div className="rounded-3xl border border-surface-border bg-surface-card p-8">
          <FileText className="mx-auto h-12 w-12 text-slate-500 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">No Active Checkout Order</h1>
          <p className="text-sm text-slate-400 mb-6">
            Please configure and upload documents from the student portal before checking out.
          </p>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to Student Portal
          </Link>
        </div>
      </div>
    );
  }

  const formattedAmount = (order.totalAmountCents / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/student"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Document Upload
        </Link>
      </div>

      <div className="rounded-3xl border border-surface-border bg-surface-card p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold text-lg">
              ₹
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">Razorpay Checkout</h1>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-400 border border-blue-500/30">
                  SANDBOX
                </span>
              </div>
              <p className="text-xs text-slate-400">CampusPrint Secured Payment Terminal</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 block">Total Due</span>
            <span className="text-2xl font-black text-white font-mono">₹{formattedAmount}</span>
          </div>
        </div>

        {/* Order Info & OTP Preview */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-dark border border-surface-border">
          <div>
            <p className="text-xs text-slate-400 font-medium">Order Number</p>
            <p className="text-sm font-mono font-bold text-white mt-0.5">#{order.id.substring(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Reserved Pickup OTP</p>
            <p className="text-sm font-mono font-black text-amber-400 mt-0.5 tracking-wider">
              {order.collectionOtp || '----'}
            </p>
          </div>
        </div>

        {/* Items breakdown */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Documents in Order</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {(order.items || []).map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-center justify-between p-3 rounded-xl border border-surface-border bg-surface-dark text-xs"
              >
                <div className="truncate max-w-[280px]">
                  <p className="font-semibold text-white truncate">
                    {(item as any).documentName || item.document?.fileName || `Document ${idx + 1}`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {item.colorMode} • {item.paperSize} • {item.duplexMode} • x{item.copies} copies •{' '}
                    {item.computedSheets} sheets
                  </p>
                </div>
                <span className="font-mono font-bold text-white">
                  ₹{((item.itemTotalCents || 0) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="space-y-1.5 border-t border-surface-border pt-3 text-xs text-slate-300">
          <div className="flex justify-between">
            <span>Physical Sheets Total:</span>
            <span className="font-mono font-semibold text-white">{order.totalSheets} sheets</span>
          </div>
          <div className="flex justify-between">
            <span>Printing Subtotal:</span>
            <span className="font-mono font-semibold text-white">₹{(order.subtotalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Campus Queue & Platform Fee:</span>
            <span className="font-mono font-semibold text-white">
              ₹{(order.convenienceFeeCents / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-surface-border">
            <span>Total Payable Amount:</span>
            <span className="font-mono text-brand-400 text-base">₹{formattedAmount}</span>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="space-y-3 pt-2">
          {/* 1. Simulate UPI Button */}
          <button
            type="button"
            onClick={() => handleSimulatePayment('success')}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Capturing Payment & Triggering Dispatch...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Simulate Successful UPI Payment (₹{formattedAmount})
              </>
            )}
          </button>

          {/* 2. Official Modal Button */}
          <button
            type="button"
            onClick={handleLaunchRazorpaySDK}
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl bg-surface-elevated hover:bg-slate-700 border border-surface-border text-slate-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
            Launch Official Razorpay Modal
          </button>

          {/* 3. Simulate Failure Button */}
          <button
            type="button"
            onClick={() => handleSimulatePayment('failure')}
            disabled={isProcessing}
            className="w-full py-2 px-4 rounded-xl bg-surface-dark hover:bg-rose-950/20 border border-surface-border text-slate-400 hover:text-rose-400 text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Simulate Declined / Cancelled Transaction
          </button>
        </div>

        <div className="border-t border-surface-border pt-4 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            256-bit encrypted test session • Instant print dispatch upon confirmation
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
