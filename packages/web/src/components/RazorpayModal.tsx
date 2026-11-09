'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, CheckCircle2, Loader2, CreditCard, Smartphone, ExternalLink } from 'lucide-react';
import { verifyPayment, createRazorpayOrder } from '@/lib/api';

interface RazorpayModalProps {
  orderId: string;
  totalAmountCents: number;
  collectionOtp: string;
  onSuccess: (orderId: string) => void;
  onClose: () => void;
}

export function RazorpayModal({
  orderId,
  totalAmountCents,
  collectionOtp,
  onSuccess,
  onClose,
}: RazorpayModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card'>('upi');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rzpOrderId, setRzpOrderId] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  const formattedAmount = (totalAmountCents / 100).toFixed(2);

  // Load Razorpay script & initialize order on backend
  useEffect(() => {
    let scriptLoaded = false;
    const existingScript = document.getElementById('razorpay-checkout-js');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-js';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setSdkLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      setSdkLoaded(true);
    }

    createRazorpayOrder(orderId, totalAmountCents)
      .then((res) => {
        if (res && res.rzpOrderId) {
          setRzpOrderId(res.rzpOrderId);
        }
      })
      .catch((err) => {
        console.warn('Backend Razorpay order creation fallback:', err.message);
        setRzpOrderId(`order_mock_${orderId.substring(0, 8)}`);
      });
  }, [orderId, totalAmountCents]);

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const activeRzpOrderId = rzpOrderId || `order_mock_${Math.floor(100000 + Math.random() * 900000)}`;
      const mockRzpPaymentId = `pay_mock_${Math.floor(100000 + Math.random() * 900000)}`;

      await verifyPayment({
        orderId,
        rzpOrderId: activeRzpOrderId,
        rzpPaymentId: mockRzpPaymentId,
        rzpSignature: 'mock_signature_verified',
      });

      onSuccess(orderId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment simulation failed');
      setIsProcessing(false);
    }
  };

  const handleOpenOfficialCheckout = () => {
    if (typeof window === 'undefined' || !(window as any).Razorpay) {
      handleSimulatePayment();
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_campus123',
        amount: totalAmountCents,
        currency: 'INR',
        name: 'CampusPrint Centre',
        description: `Print Order #${orderId.substring(0, 8)}`,
        order_id: rzpOrderId,
        handler: async function (response: any) {
          try {
            await verifyPayment({
              orderId,
              rzpOrderId: response.razorpay_order_id,
              rzpPaymentId: response.razorpay_payment_id,
              rzpSignature: response.razorpay_signature,
            });
            onSuccess(orderId);
          } catch (verifyErr: any) {
            setErrorMessage(verifyErr.message || 'Payment verification failed');
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
      rzpInstance.on('payment.failed', function (failRes: any) {
        setErrorMessage(failRes.error?.description || 'Payment was declined or cancelled');
        setIsProcessing(false);
      });
      rzpInstance.open();
    } catch (err: any) {
      console.warn('Official checkout popup fallback:', err.message);
      handleSimulatePayment();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-surface-border bg-surface-card p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-surface-elevated hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Razorpay Brand Header */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold">
            ₹
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-white text-base">
              Razorpay <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">TEST MODE</span>
            </div>
            <p className="text-xs text-slate-400">CampusPrint Fast Checkout Gateway</p>
          </div>
        </div>

        {/* Order Details Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-surface-dark border border-surface-border text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Amount Due</p>
          <div className="text-3xl font-extrabold text-white mt-1">₹{formattedAmount}</div>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs font-mono text-slate-400">Order Ref: #{orderId.substring(0, 8)}</span>
            {rzpOrderId && (
              <span className="text-[11px] font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">
                RZP: {rzpOrderId.substring(0, 14)}...
              </span>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3 mb-6">
          <div
            onClick={() => setSelectedMethod('upi')}
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedMethod === 'upi'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-border bg-surface-dark hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-white">Instant UPI / QR Code</p>
                <p className="text-xs text-slate-400">Google Pay, PhonePe, Paytm, BHIM</p>
              </div>
            </div>
            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${selectedMethod === 'upi' ? 'border-brand-500 bg-brand-500' : 'border-slate-600'}`}>
              {selectedMethod === 'upi' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
          </div>

          <div
            onClick={() => setSelectedMethod('card')}
            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
              selectedMethod === 'card'
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-border bg-surface-dark hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-brand-400" />
              <div>
                <p className="text-sm font-semibold text-white">Debit / Credit Card</p>
                <p className="text-xs text-slate-400">Visa, Mastercard, RuPay</p>
              </div>
            </div>
            <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${selectedMethod === 'card' ? 'border-brand-500 bg-brand-500' : 'border-slate-600'}`}>
              {selectedMethod === 'card' && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleSimulatePayment}
            disabled={isProcessing}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying Payment & Dispatching...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Simulate Successful UPI Payment (₹{formattedAmount})
              </>
            )}
          </button>

          {sdkLoaded && (
            <button
              type="button"
              onClick={handleOpenOfficialCheckout}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-elevated hover:bg-slate-700 border border-surface-border text-slate-300 hover:text-white font-medium text-xs transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
              Open Official Razorpay Modal
            </button>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-surface-border text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            End-to-end encrypted test sandbox session • OTP {collectionOtp} reserved
          </p>
        </div>
      </div>
    </div>
  );
}
