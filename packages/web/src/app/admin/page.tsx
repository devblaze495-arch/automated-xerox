'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  getAdminOverview,
  createAdminCenter,
  extendCenterSubscription,
  AdminOverviewResponse,
} from '@/lib/api';
import {
  Shield,
  KeyRound,
  Store,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Printer,
  Copy,
  Check,
  Plus,
  RefreshCw,
  ExternalLink,
  DollarSign,
  QrCode,
  Sliders,
  TrendingUp,
  Cpu,
  Lock,
  Calendar,
  X,
} from 'lucide-react';

export default function SuperAdminPortal() {
  const [adminSecret, setAdminSecret] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Onboarding Modal State
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    code: '',
    location: '',
    ownerName: '',
    ownerPhone: '',
    upiVpa: '',
  });

  // Success / Credential Display Modal State
  const [onboardResult, setOnboardResult] = useState<{
    centerId: string;
    code: string;
    name: string;
    agentSecret: string;
    appsettingsSnippet: any;
    standeeUrl: string;
  } | null>(null);

  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [extendingCenterId, setExtendingCenterId] = useState<string | null>(null);

  // Restore authenticated session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('cp_admin_secret');
    if (saved) {
      setAdminSecret(saved);
      setIsAuthenticated(true);
      loadData(saved);
    }
  }, []);

  const loadData = async (secret: string) => {
    setIsLoading(true);
    setRefreshError(null);
    try {
      const data = await getAdminOverview(secret);
      setOverview(data);
    } catch (err: any) {
      setRefreshError(err.message || 'Failed to load platform overview');
      if (err.message && err.message.toLowerCase().includes('auth')) {
        setIsAuthenticated(false);
        localStorage.removeItem('cp_admin_secret');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    setAuthError(null);
    setIsLoading(true);

    try {
      const data = await getAdminOverview(inputKey.trim());
      setAdminSecret(inputKey.trim());
      setIsAuthenticated(true);
      setOverview(data);
      localStorage.setItem('cp_admin_secret', inputKey.trim());
    } catch (err: any) {
      setAuthError(err.message || 'Invalid Super-Admin Secret Key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminSecret('');
    setOverview(null);
    localStorage.removeItem('cp_admin_secret');
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.name || !onboardForm.code || !onboardForm.location) {
      alert('Please fill out all required fields.');
      return;
    }

    setIsSubmittingOnboard(true);
    try {
      const res = await createAdminCenter(adminSecret, onboardForm);
      setOnboardResult(res.data);
      setIsOnboardModalOpen(false);
      setOnboardForm({
        name: '',
        code: '',
        location: '',
        ownerName: '',
        ownerPhone: '',
        upiVpa: '',
      });
      // Refresh list
      loadData(adminSecret);
    } catch (err: any) {
      alert(err.message || 'Failed to onboard center');
    } finally {
      setIsSubmittingOnboard(false);
    }
  };

  const handleExtendLicense = async (centerId: string) => {
    setExtendingCenterId(centerId);
    try {
      await extendCenterSubscription(adminSecret, centerId, 30);
      await loadData(adminSecret);
    } catch (err: any) {
      alert(err.message || 'Failed to extend license');
    } finally {
      setExtendingCenterId(null);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'json') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'secret') {
        setCopiedSecret(true);
        setTimeout(() => setCopiedSecret(false), 2000);
      } else {
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
      }
    } catch (_err) {}
  };

  // If not authenticated, render Auth Gate Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400" />

            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 mb-2">
                <Shield className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Super-Admin Portal</h1>
              <p className="text-xs text-slate-400">
                Platform-wide Xerox centre onboarding, B2B SaaS revenue, and hardware telemetry.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Super-Admin Master Secret
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter ADMIN_SECRET..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-card border border-surface-border text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                  <KeyRound className="h-4 w-4 text-slate-500 absolute right-3.5 top-3" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Unlock Super-Admin</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500 font-mono">
                  Default dev secret: <code className="text-slate-400">super_campus_admin_2026</code>
                </p>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const metrics = overview?.metrics || {
    totalActiveCenters: 0,
    activeSubscriptions: 0,
    expiredSubscriptions: 0,
    totalSaasRevenueInr: 0,
    totalPrintOrders: 0,
    totalPrintRevenueInr: 0,
  };

  const centers = overview?.centers || [];

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
              <Shield className="h-3.5 w-3.5" />
              <span>Platform Super-Admin Mode</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Multi-Shop Operations & SaaS Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Onboard campus centres, audit B2B subscription licenses, and monitor Windows print agents.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadData(adminSecret)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-300 hover:text-white transition"
              title="Refresh platform metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOnboardModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm shadow-md transition"
            >
              <Plus className="h-4 w-4" />
              <span>Onboard New Xerox Centre</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition"
            >
              Lock Portal
            </button>
          </div>
        </div>

        {refreshError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
            <span>{refreshError}</span>
            <button onClick={() => loadData(adminSecret)} className="underline font-bold">
              Retry
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TOP KPI CARDS */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total SaaS Revenue */}
          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total SaaS Revenue</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              ₹{metrics.totalSaasRevenueInr.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <span>B2B Platform Recurring Licenses</span>
            </p>
          </div>

          {/* Card 2: Active Xerox Centres */}
          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Xerox Centres</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Store className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics.totalActiveCenters}
            </div>
            <p className="text-[11px] text-blue-400 mt-1 font-medium">
              Multi-shop campus network
            </p>
          </div>

          {/* Card 3: Active vs Expired Subscriptions */}
          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">SaaS Subscriptions</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                {metrics.activeSubscriptions}
              </span>
              <span className="text-xs text-slate-400">Active</span>
              <span className="text-slate-600">/</span>
              <span className="text-sm font-bold text-rose-400">
                {metrics.expiredSubscriptions}
              </span>
              <span className="text-xs text-slate-400">Expired</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              ₹99 Intro / ₹249 Monthly / ₹2,488 Annual
            </p>
          </div>

          {/* Card 4: Total Student Prints */}
          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Campus Prints Processed</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Printer className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              {metrics.totalPrintOrders}
            </div>
            <p className="text-[11px] text-amber-400 mt-1 font-medium">
              ₹{metrics.totalPrintRevenueInr.toLocaleString('en-IN')} student gross volume
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* ONBOARDED CENTRES DIRECTORY TABLE */}
        {/* ======================================================== */}
        <div className="rounded-2xl border border-surface-border bg-surface-dark shadow-xl overflow-hidden">
          <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="h-5 w-5 text-brand-400" />
                <span>Onboarded Xerox Centres Directory</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical shop locations, operator licenses, and hardware background agent connections.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Showing {centers.length} center{centers.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-card text-slate-400 border-b border-surface-border uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Center & Campus Location</th>
                  <th className="py-3.5 px-4 font-bold">Operator & VPA</th>
                  <th className="py-3.5 px-4 font-bold">SaaS License</th>
                  <th className="py-3.5 px-4 font-bold">Print Agent</th>
                  <th className="py-3.5 px-4 font-bold">Orders / Volume</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-slate-200">
                {centers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No Xerox centres onboarded yet. Click &quot;Onboard New Xerox Centre&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  centers.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-card/50 transition">
                      {/* Name & Code */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] bg-slate-800 text-blue-400 px-1.5 py-0.5 rounded border border-slate-700 font-semibold">
                            {c.code}
                          </span>
                          <span className="text-slate-400 text-[11px] truncate max-w-[200px]">
                            {c.location}
                          </span>
                        </div>
                      </td>

                      {/* Operator Details */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{c.ownerName || 'Operator'}</div>
                        <div className="text-[11px] text-slate-400">{c.ownerPhone}</div>
                        <div className="text-[10px] font-mono text-emerald-400 mt-0.5">{c.upiVpa}</div>
                      </td>

                      {/* Subscription Status */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.subscription?.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {c.subscription?.status || 'INACTIVE'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {c.subscription?.tier || 'STARTER_INTRO'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>
                            {c.subscription?.daysRemaining !== undefined
                              ? `${c.subscription.daysRemaining} days remaining`
                              : 'Expires: 30 days'}
                          </span>
                        </div>
                      </td>

                      {/* Agent Telemetry */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              c.agentStatus?.isOnline
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-slate-500'
                            }`}
                          />
                          <span className="font-bold text-white text-[11px]">
                            {c.agentStatus?.isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {c.agentStatus?.deviceModel !== 'Offline'
                            ? c.agentStatus.deviceModel
                            : 'Windows Background Service'}
                        </div>
                      </td>

                      {/* Orders */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-white">{c.orderCount || 0} orders</div>
                        <div className="text-[11px] text-slate-400">
                          ₹{(c.revenueGeneratedInr || 0).toLocaleString('en-IN')} gross
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleExtendLicense(c.id)}
                          disabled={extendingCenterId === c.id}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px] transition shadow-sm"
                          title="Extend SaaS subscription by 30 days"
                        >
                          {extendingCenterId === c.id ? 'Extending...' : '+30 Days License'}
                        </button>

                        <Link
                          href={`/operator/poster`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface-card hover:bg-surface-elevated text-slate-300 hover:text-white font-semibold text-[11px] transition shadow-sm"
                          title="Print counter QR standee"
                        >
                          <QrCode className="h-3 w-3 text-blue-400" />
                          <span>Standee</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Distribution & Standee Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-brand-400" />
                <span>Print Counter QR Standees</span>
              </h3>
              <p className="text-xs text-slate-400">
                Generate high-resolution printable A4/A5 desk standees for student onboarding.
              </p>
            </div>
            <Link
              href="/operator/poster"
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shrink-0"
            >
              Open Generator
            </Link>
          </div>

          <div className="p-5 rounded-2xl bg-surface-dark border border-surface-border flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 text-emerald-400" />
                <span>Student APK Download Landing Page</span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct mobile-first APK distribution link with auto-shop routing parameter.
              </p>
            </div>
            <Link
              href="/download?center=CTR-CAMPUS-01"
              target="_blank"
              className="px-3 py-2 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-white text-xs font-bold transition shrink-0"
            >
              Preview /download
            </Link>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* ONBOARD NEW CENTRE MODAL */}
      {/* ======================================================== */}
      {isOnboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-surface-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Onboard New Xerox Centre</h3>
                  <p className="text-xs text-slate-400">Add shop to campus network & generate print agent credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-card"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-300 block mb-1">
                    Shop Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering Block A Xerox Hub"
                    value={onboardForm.name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Center Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CTR-GIT-01"
                    value={onboardForm.code}
                    onChange={(e) =>
                      setOnboardForm({ ...onboardForm, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Campus Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GIT Campus, 1st Floor"
                    value={onboardForm.location}
                    onChange={(e) => setOnboardForm({ ...onboardForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Owner / Operator Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh Kumar"
                    value={onboardForm.ownerName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, ownerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Owner Phone (WhatsApp Alert)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 11223"
                    value={onboardForm.ownerPhone}
                    onChange={(e) => setOnboardForm({ ...onboardForm, ownerPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-300 block mb-1">
                    Shop UPI VPA (Direct Settlement)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. gitxerox@okaxis"
                    value={onboardForm.upiVpa}
                    onChange={(e) => setOnboardForm({ ...onboardForm, upiVpa: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-card border border-surface-border text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsOnboardModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-border text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOnboard}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-md transition"
                >
                  {isSubmittingOnboard ? 'Onboarding...' : 'Create & Generate Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ONBOARDING SUCCESS / CREDENTIALS MODAL */}
      {/* ======================================================== */}
      {onboardResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-surface-dark border border-surface-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Centre Onboarded Successfully!</h3>
                <p className="text-xs text-slate-400">
                  {onboardResult.name} (<span className="font-mono text-emerald-400">{onboardResult.code}</span>)
                </p>
              </div>
            </div>

            {/* Generated Agent Secret */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Windows Print Agent Secret Token (Keep Secure)
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-card border border-surface-border font-mono text-xs text-amber-300">
                <span className="flex-1 truncate select-all">{onboardResult.agentSecret}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(onboardResult.agentSecret, 'secret')}
                  className="p-1 rounded-lg hover:bg-surface-elevated text-slate-300 hover:text-white shrink-0"
                >
                  {copiedSecret ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Ready-to-copy appsettings.json Snippet */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  Windows Agent Config (<code className="text-blue-400">appsettings.json</code>)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(JSON.stringify(onboardResult.appsettingsSnippet, null, 2), 'json')
                  }
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                >
                  {copiedJson ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Config JSON</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                {JSON.stringify(onboardResult.appsettingsSnippet, null, 2)}
              </pre>
            </div>

            {/* Quick Next Steps */}
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
              <span className="font-bold text-blue-300 block">Next Steps for Centre Operator:</span>
              <ol className="list-decimal list-inside text-slate-300 space-y-1 text-[11px]">
                <li>Paste the config above into the shop PC&apos;s Windows Print Agent directory.</li>
                <li>Print the Counter QR Standee poster for student onboarding.</li>
                <li>30-day initial trial subscription is active immediately!</li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Link
                href="/operator/poster"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition"
              >
                Print Standee Poster
              </Link>
              <button
                type="button"
                onClick={() => setOnboardResult(null)}
                className="px-5 py-2 rounded-xl bg-surface-card hover:bg-surface-elevated text-slate-200 font-semibold text-xs border border-surface-border transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
