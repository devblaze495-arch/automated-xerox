'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Lock,
  Sparkles,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Loader2,
  ExternalLink,
  Flame,
  Award,
  Laptop,
} from 'lucide-react';
import {
  getSubscriptionStatus,
  subscribeToPlan,
  simulateSubscriptionWebhook,
} from '@/lib/api';
import { SubscriptionStatusInfo, SubscribeOrderResponse } from '@/lib/types';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const [statusInfo, setStatusInfo] = useState<SubscriptionStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePaymentOrder, setActivePaymentOrder] = useState<SubscribeOrderResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Poll subscription status
  const fetchStatus = useCallback(async () => {
    try {
      const data = await getSubscriptionStatus();
      setStatusInfo(data);
      if (data.isSubscribed) {
        setActivePaymentOrder(null);
      }
    } catch (err: any) {
      console.warn('Could not fetch subscription status:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Auto-poll every 3 seconds to immediately unlock paywall when webhook captures payment
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSubscribe = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const order = await subscribeToPlan(selectedPlan);
      setActivePaymentOrder(order);

      // Attempt popup redirect to self-hosted UPI gateway
      if (typeof window !== 'undefined' && order.paymentUrl) {
        window.open(order.paymentUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate subscription order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateWebhookSuccess = async () => {
    if (!activePaymentOrder) return;
    setIsSimulating(true);

    try {
      await simulateSubscriptionWebhook(
        activePaymentOrder.clientOrderId,
        activePaymentOrder.amount
      );
      // Immediate re-fetch
      await fetchStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-xs text-slate-400 font-mono">Verifying shop terminal SaaS license...</p>
      </div>
    );
  }

  // Active Subscriber View: Unlocked Operator Terminal
  if (statusInfo?.isSubscribed) {
    const formattedEnd = statusInfo.currentPeriodEnd
      ? new Date(statusInfo.currentPeriodEnd).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    return (
      <div className="relative">
        {/* Subtle Membership Pill Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-surface-dark border border-surface-border text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">Xerox Shop Terminal Active</span>
              <span className="px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono font-bold text-[10px] border border-brand-500/30">
                {statusInfo.tier.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center gap-4 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {statusInfo.daysRemaining} days remaining (Expires {formattedEnd})
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                Terminal Dispatch & Spooling Privilege Enabled
              </span>
            </div>
          </div>
        </div>

        {/* Unlocked Protected Content */}
        {children}
      </div>
    );
  }

  // Inactive / Expired: Netflix-Style Persistent Paywall Overlay for Shop Operator
  const isIntroEligible = statusInfo?.eligiblePromo ?? true;

  return (
    <div className="relative min-h-[85vh] overflow-hidden">
      {/* Blurred background preview of the dashboard */}
      <div className="pointer-events-none select-none opacity-20 blur-md filter" aria-hidden="true">
        {children}
      </div>

      {/* Netflix-Style Modal Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-3xl border border-surface-border bg-surface-card p-6 sm:p-10 shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-200">
          {/* Glowing Top Ambient Accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-3/4 bg-gradient-to-r from-transparent via-brand-500 to-transparent blur-sm" />

          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold">
              <Lock className="h-3.5 w-3.5" />
              Shop Owner Terminal License Required
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Activate Xerox Shop Operator Terminal
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Subscribe to unlock real-time incoming student print queues, automated hardware spooling, Canon printer routing, and 4-digit OTP handover verification.
            </p>
          </div>

          {/* Pricing Tier Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* 1. Monthly Starter Pass */}
            <div
              onClick={() => setSelectedPlan('MONTHLY')}
              className={`relative rounded-2xl p-5 border cursor-pointer transition-all ${
                selectedPlan === 'MONTHLY'
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'border-surface-border bg-surface-dark hover:border-slate-600'
              }`}
            >
              {isIntroEligible && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider shadow">
                  <Flame className="h-3 w-3 fill-black" />
                  First Month Promo
                </div>
              )}

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">Shop Starter Pass</h3>
                  <p className="text-xs text-slate-400 mt-0.5">30 Days Terminal License</p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                    selectedPlan === 'MONTHLY' ? 'border-brand-500 bg-brand-500' : 'border-slate-600'
                  }`}
                >
                  {selectedPlan === 'MONTHLY' && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">
                  ₹{isIntroEligible ? '99' : '249'}
                </span>
                <span className="text-xs text-slate-400">/ 30 days</span>
                {isIntroEligible && (
                  <span className="text-xs text-slate-500 line-through ml-1">₹249</span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                {isIntroEligible
                  ? 'Introductory launch rate for campus shop owners. Renews at ₹249/mo.'
                  : 'Standard monthly Xerox shop license renewal.'}
              </p>

              <ul className="mt-4 space-y-1.5 text-xs text-slate-300 border-t border-surface-border pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Incoming Student Orders & Auto Spooling</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>4-Digit OTP Pickup Verification</span>
                </li>
              </ul>
            </div>

            {/* 2. Annual Campus Pass */}
            <div
              onClick={() => setSelectedPlan('ANNUAL')}
              className={`relative rounded-2xl p-5 border cursor-pointer transition-all ${
                selectedPlan === 'ANNUAL'
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'border-surface-border bg-surface-dark hover:border-slate-600'
              }`}
            >
              <div className="absolute -top-3 left-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                <Award className="h-3 w-3 fill-slate-950" />
                Best Value • Save 20%
              </div>

              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-white text-base">Annual Commercial Pass</h3>
                  <p className="text-xs text-slate-400 mt-0.5">365 Days Non-Stop Access</p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                    selectedPlan === 'ANNUAL' ? 'border-brand-500 bg-brand-500' : 'border-slate-600'
                  }`}
                >
                  {selectedPlan === 'ANNUAL' && <div className="h-2 w-2 rounded-full bg-white" />}
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-white">₹2,488</span>
                <span className="text-xs text-slate-400">/ 365 days</span>
                <span className="text-[10px] text-emerald-400 font-mono ml-1">(~₹207/mo)</span>
              </div>

              <p className="text-[11px] text-slate-400 mt-2">
                Full academic year commercial pass. Uncapped job processing and priority printer bridge routing.
              </p>

              <ul className="mt-4 space-y-1.5 text-xs text-slate-300 border-t border-surface-border pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Unlimited Spooling & Multi-Printer Bridge</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Canon PIXMA & imageRUNNER Auto-Routing</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Active Payment Pending State with Auto-Polling */}
          {activePaymentOrder ? (
            <div className="mb-6 p-5 rounded-2xl bg-surface-dark border border-brand-500/30 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-brand-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for UPI Payment Confirmation via mynkdev-21/upi-gateway...</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={activePaymentOrder.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-colors shadow"
                >
                  <span>Open UPI Payment Page (₹{activePaymentOrder.amount})</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {/* Instant Sandbox Bypass */}
                <button
                  type="button"
                  onClick={handleSimulateWebhookSuccess}
                  disabled={isSimulating}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow"
                >
                  {isSimulating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  <span>Simulate Instant Webhook Approval</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400">
                Order ID: <code className="text-white font-mono">{activePaymentOrder.clientOrderId}</code> • Auto-unlocking terminal as soon as paid.
              </p>
            </div>
          ) : (
            /* Subscribe Button */
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-xl shadow-brand-900/40 flex items-center justify-center gap-2 group"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting to UPI Gateway...</span>
                </>
              ) : (
                <>
                  <span>
                    Activate Terminal with UPI (₹
                    {selectedPlan === 'ANNUAL' ? '2,488' : isIntroEligible ? '99' : '249'})
                  </span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          )}

          {errorMessage && (
            <p className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
              {errorMessage}
            </p>
          )}

          {/* Footer Security Badges */}
          <div className="mt-6 pt-4 border-t border-surface-border flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Secured by Self-Hosted UPI Gateway
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-brand-400" />
              Instant Terminal Activation
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Laptop className="h-3.5 w-3.5 text-amber-400" />
              B2B Operator Platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
