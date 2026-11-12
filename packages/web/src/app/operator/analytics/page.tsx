'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import {
  getOperatorAnalytics,
  exportOperatorAnalyticsCsv,
  purgeDocument,
  getShopSettings,
  updateShopSettings,
} from '@/lib/api';
import {
  OperatorAnalyticsResponse,
  ShopSettings,
  PresetRange,
  CollectionLedgerItem,
} from '@/lib/types';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Clock,
  Search,
  Sliders,
  Package,
  IndianRupee,
  Filter,
  Check,
} from 'lucide-react';

const PRESET_OPTIONS: Array<{ id: PresetRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 Days' },
  { id: '15days', label: 'Last 15 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'year', label: 'Financial Year (FY)' },
  { id: 'custom', label: 'Custom Range' },
];

export default function OperatorAnalyticsPage() {
  const [analytics, setAnalytics] = useState<OperatorAnalyticsResponse | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetRange>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [purgingDocId, setPurgingDocId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter state for ledger
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COLLECTED' | 'QUEUED' | 'REFUNDED'>('ALL');

  // Quick Stock Update Modal state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockInputA4, setStockInputA4] = useState<number>(500);
  const [stockInputA3, setStockInputA3] = useState<number>(100);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  const fetchAnalyticsData = async (preset: PresetRange = selectedPreset, start?: string, end?: string) => {
    setIsLoading(true);
    try {
      const [data, settings] = await Promise.all([
        getOperatorAnalytics({
          preset,
          startDate: preset === 'custom' ? (start || customStartDate) : undefined,
          endDate: preset === 'custom' ? (end || customEndDate) : undefined,
        }),
        getShopSettings().catch(() => null),
      ]);
      setAnalytics(data);
      if (settings) {
        setShopSettings(settings);
        setStockInputA4(settings.paperStockA4);
        setStockInputA3(settings.paperStockA3);
      }
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      showToast(err.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData(selectedPreset);
  }, [selectedPreset]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePresetSelect = (preset: PresetRange) => {
    setSelectedPreset(preset);
    if (preset !== 'custom') {
      fetchAnalyticsData(preset);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate) {
      showToast('Please select a start date');
      return;
    }
    fetchAnalyticsData('custom', customStartDate, customEndDate);
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await exportOperatorAnalyticsCsv({
        preset: selectedPreset,
        startDate: selectedPreset === 'custom' ? customStartDate : undefined,
        endDate: selectedPreset === 'custom' ? customEndDate : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operator_financial_report_${selectedPreset}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('CSV report exported successfully!');
    } catch (err: any) {
      showToast(err.message || 'Failed to export CSV report');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePurgeDocument = async (documentId: string, docName: string) => {
    if (!confirm(`Are you sure you want to permanently purge "${docName}" from storage?\n\nThis will physically delete the PDF file blob to preserve student privacy. Analytical sheet counts and financial revenue records will remain permanently intact.`)) {
      return;
    }

    setPurgingDocId(documentId);
    try {
      await purgeDocument(documentId);
      showToast(`Document "${docName}" permanently purged. Metadata retained.`);
      // Update local state in analytics
      setAnalytics((prev) => {
        if (!prev) return prev;
        const updatedLedger = prev.ledger.map((item) => {
          if (item.documentId === documentId) {
            return { ...item, isPurged: true, purgedAt: new Date().toISOString() };
          }
          return item;
        });
        return { ...prev, ledger: updatedLedger };
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to purge document');
    } finally {
      setPurgingDocId(null);
    }
  };

  const handleSaveStock = async () => {
    setIsUpdatingStock(true);
    try {
      const updated = await updateShopSettings({
        paperStockA4: Number(stockInputA4),
        paperStockA3: Number(stockInputA3),
      });
      setShopSettings(updated);
      setIsStockModalOpen(false);
      showToast('Paper inventory stock updated successfully!');
      // Refresh analytics metrics
      fetchAnalyticsData(selectedPreset);
    } catch (err: any) {
      showToast(err.message || 'Failed to update stock');
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Filtered Ledger
  const filteredLedger = useMemo(() => {
    if (!analytics) return [];
    return analytics.ledger.filter((item) => {
      const matchesSearch =
        item.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.studentPhone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.documentName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COLLECTED' && (item.status === 'COLLECTED' || item.status === 'COMPLETED')) ||
        (statusFilter === 'QUEUED' && (item.status === 'QUEUED' || item.status === 'PRINTING' || item.status === 'READY_FOR_COLLECTION' || item.status === 'PAYMENT_VERIFIED')) ||
        (statusFilter === 'REFUNDED' && (item.status === 'REFUNDED' || item.status === 'CANCELLED' || item.status === 'REJECTED'));

      return matchesSearch && matchesStatus;
    });
  }, [analytics, searchQuery, statusFilter]);

  // Hourly volume max calculation for chart scaling
  const maxHourlyVolume = useMemo(() => {
    if (!analytics) return 1;
    const max = Math.max(...analytics.hourlyDistribution.map((h) => h.sheetCount), 1);
    return max;
  }, [analytics]);

  const metrics = analytics?.metrics;

  return (
    <div className="min-h-screen flex flex-col bg-background text-slate-100">
      <Navbar />

      <SubscriptionGate>
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Header & Breadcrumb */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link
                href="/operator"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-2 group"
              >
                <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
                Back to Operator Workbench
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Operator Analytics & Financial Ledger
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Revenue breakdown, physical paper stock consumption, and privacy audit logs.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions: Refresh & Export CSV */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchAnalyticsData(selectedPreset)}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-slate-300 hover:text-white text-xs font-semibold transition-all"
                title="Refresh Analytics Data"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-brand-400' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting || isLoading || !analytics?.ledger?.length}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md disabled:opacity-50"
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV Report
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-0.5"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Low Paper Stock Alert Banner */}
          {metrics?.lowPaperAlert && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-100">
                    Low Paper Inventory Alert
                  </h3>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    A4 Paper Stock is at <strong>{metrics.paperStockA4} sheets</strong> left (~
                    {Math.round((metrics.paperStockA4 / 500) * 10) / 10} reams), and A3 is at{' '}
                    <strong>{metrics.paperStockA3} sheets</strong>. Replenish trays to prevent spooler halts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shrink-0 shadow"
              >
                Update Tray Stock
              </button>
            </div>
          )}

          {/* Date Range Selector Bar */}
          <div className="rounded-2xl border border-surface-border bg-surface-card p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                <Calendar className="h-4 w-4 text-brand-400" />
                Reporting Date Period
              </div>
              {analytics?.dateRange && (
                <div className="text-xs text-slate-400 font-mono">
                  {new Date(analytics.dateRange.startDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  –{' '}
                  {new Date(analytics.dateRange.endDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            {/* Preset Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePresetSelect(opt.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    selectedPreset === opt.id
                      ? 'bg-brand-500 text-white font-semibold shadow-md'
                      : 'bg-surface-dark border border-surface-border text-slate-300 hover:text-white hover:bg-surface-elevated'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs (when 'custom' preset is selected) */}
            {selectedPreset === 'custom' && (
              <div className="pt-3 border-t border-surface-border flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-surface-dark border border-surface-border text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-surface-dark border border-surface-border text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustomRange}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow transition-all"
                >
                  Apply Custom Range
                </button>
              </div>
            )}
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Gross Revenue */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Gross Revenue
                </span>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <IndianRupee className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  ₹{metrics ? metrics.grossRevenueRupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>
                    {metrics?.completedOrdersCount || 0} completed orders
                  </span>
                  {metrics && metrics.cancelledOrdersCount > 0 && (
                    <span className="text-rose-400 font-medium">
                      {metrics.cancelledOrdersCount} refunded
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-surface-dark h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* 2. Physical Paper Consumed */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Paper Consumed
                </span>
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {metrics?.totalSheets.toLocaleString('en-IN') || 0}{' '}
                  <span className="text-xs font-medium text-slate-400">sheets</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  ~{metrics ? Math.round((metrics.totalSheets / 500) * 10) / 10 : 0} standard reams (500s)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300 font-mono">
                <div>A4 Simplex: {metrics?.a4SimplexSheets || 0}</div>
                <div>A4 Duplex: {metrics?.a4DuplexSheets || 0}</div>
                <div>A3 Simplex: {metrics?.a3SimplexSheets || 0}</div>
                <div>A3 Duplex: {metrics?.a3DuplexSheets || 0}</div>
              </div>
            </div>

            {/* 3. Color vs B&W Impressions Split */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Color vs B&W Pages
                </span>
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <FileText className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white">
                  {(
                    (metrics?.colorImpressions || 0) + (metrics?.bwImpressions || 0)
                  ).toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-medium text-slate-400">impressions</span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span className="text-purple-400 font-semibold">
                    Color: {metrics?.colorImpressions || 0}
                  </span>
                  <span className="text-slate-300 font-semibold">
                    B&W: {metrics?.bwImpressions || 0}
                  </span>
                </div>
              </div>
              {/* Split Bar */}
              <div className="w-full bg-surface-dark h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics && (metrics.colorImpressions + metrics.bwImpressions) > 0
                        ? (metrics.colorImpressions / (metrics.colorImpressions + metrics.bwImpressions)) * 100
                        : 0
                    }%`,
                  }}
                  title="Color Impressions"
                />
                <div
                  className="bg-slate-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      metrics && (metrics.colorImpressions + metrics.bwImpressions) > 0
                        ? (metrics.bwImpressions / (metrics.colorImpressions + metrics.bwImpressions)) * 100
                        : 100
                    }%`,
                  }}
                  title="Black & White Impressions"
                />
              </div>
            </div>

            {/* 4. Estimated Paper Stock Left */}
            <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Paper Inventory
                </span>
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(true)}
                  className="p-1.5 rounded-lg bg-surface-dark hover:bg-surface-elevated text-slate-300 hover:text-white transition-colors"
                  title="Update Paper Stock"
                >
                  <Sliders className="h-4 w-4 text-brand-400" />
                </button>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-white flex items-baseline gap-2">
                  <span>{metrics?.paperStockA4 || 0}</span>
                  <span className="text-xs font-medium text-slate-400">A4 sheets</span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                  <span>
                    A3 Tray: <strong>{metrics?.paperStockA3 || 0} sheets</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      metrics?.lowPaperAlert
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {metrics?.lowPaperAlert ? 'LOW STOCK' : 'IN STOCK'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(true)}
                className="w-full py-1.5 rounded-xl border border-surface-border bg-surface-dark hover:bg-surface-elevated text-xs font-semibold text-slate-300 hover:text-white transition-all text-center"
              >
                Adjust Tray Stock
              </button>
            </div>
          </div>

          {/* Hourly Order Volume Distribution */}
          <div className="rounded-2xl border border-surface-border bg-surface-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-400" />
                Hourly Print Volume Distribution (00:00 – 23:00)
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                Total Orders: {metrics?.totalOrdersCount || 0}
              </span>
            </div>

            {/* 24-Hour Bar Chart */}
            <div className="h-44 w-full flex items-end gap-1.5 pt-6 pb-2 px-1 overflow-x-auto">
              {analytics?.hourlyDistribution.map((item) => {
                const heightPercent = maxHourlyVolume > 0
                  ? Math.max(item.sheetCount > 0 ? 12 : 3, (item.sheetCount / maxHourlyVolume) * 100)
                  : 3;

                return (
                  <div
                    key={item.hour}
                    className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-14 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 bg-surface-elevated border border-surface-border px-2.5 py-1.5 rounded-xl shadow-xl text-[11px] text-white whitespace-nowrap text-center">
                      <div className="font-bold">{item.label}</div>
                      <div className="text-slate-300">
                        {item.orderCount} orders · {item.sheetCount} sheets
                      </div>
                      <div className="text-emerald-400 font-semibold">₹{item.revenue}</div>
                    </div>

                    {/* Bar */}
                    <div className="w-full bg-surface-dark rounded-t-md h-32 flex items-end overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          item.sheetCount > 0
                            ? 'bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-500 group-hover:to-brand-300'
                            : 'bg-surface-border/40'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    {/* Hour label */}
                    <span className="text-[10px] text-slate-400 group-hover:text-white font-mono">
                      {item.hour % 2 === 0 ? String(item.hour).padStart(2, '0') : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Collection History Table & Privacy Audit Ledger */}
          <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
            <div className="p-5 border-b border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Itemized Collection History & Document Privacy Audit Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Permanent analytical records. Physical PDF documents can be securely purged without altering accounting.
                </p>
              </div>

              {/* Search & Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by student, file, ID..."
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-surface-dark border border-surface-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 w-52 sm:w-64"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-surface-dark border border-surface-border text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COLLECTED">Collected / Completed</option>
                  <option value="QUEUED">Queued / Active</option>
                  <option value="REFUNDED">Refunded / Cancelled</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-surface-dark/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Order ID & Date</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Document Name</th>
                    <th className="py-3 px-4">Print Options</th>
                    <th className="py-3 px-4 text-center">Sheets</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">File Privacy Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No transactions found matching the selected range and filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item, idx) => (
                      <tr key={`${item.orderId}-${idx}`} className="hover:bg-surface-elevated/40 transition-colors">
                        {/* Order ID & Date */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="font-bold text-white">#{item.orderId.substring(0, 8)}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(item.createdAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Student */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{item.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.studentPhone}</div>
                        </td>

                        {/* Document Name */}
                        <td className="py-3.5 px-4 max-w-xs truncate" title={item.documentName}>
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <FileText className="h-3.5 w-3.5 text-brand-400 shrink-0" />
                            <span className="truncate">{item.documentName}</span>
                          </div>
                        </td>

                        {/* Print Options */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-[10px] font-mono font-semibold">
                              {item.paperSize}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-[10px]">
                              {item.duplexMode !== 'SIMPLEX' ? 'Duplex' : 'Simplex'}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                item.colorMode === 'COLOR'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-slate-700/40 text-slate-300'
                              }`}
                            >
                              {item.colorMode}
                            </span>
                            {item.copies > 1 && (
                              <span className="text-[10px] text-slate-400 font-bold">×{item.copies}</span>
                            )}
                          </div>
                        </td>

                        {/* Sheets */}
                        <td className="py-3.5 px-4 text-center font-bold text-white">
                          {item.totalSheets}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right font-extrabold text-white font-mono">
                          ₹{item.amountRupees.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'COLLECTED' || item.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : item.status === 'READY_FOR_COLLECTION'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : item.status === 'QUEUED' || item.status === 'PRINTING'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Document Retention & Privacy Purge */}
                        <td className="py-3.5 px-4 text-center">
                          {item.isPurged ? (
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold"
                              title={item.purgedAt ? `Purged on ${new Date(item.purgedAt).toLocaleString('en-IN')}` : 'Purged from disk'}
                            >
                              <ShieldCheck className="h-3 w-3 text-emerald-400" />
                              Purged (Metadata Only)
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="inline-block px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-medium">
                                Stored
                              </span>
                              <button
                                type="button"
                                onClick={() => handlePurgeDocument(item.documentId, item.documentName)}
                                disabled={purgingDocId === item.documentId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-[10px] font-bold transition-all disabled:opacity-50"
                                title="Permanently delete physical PDF from storage while preserving transaction ledger"
                              >
                                {purgingDocId === item.documentId ? (
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-2.5 w-2.5" />
                                )}
                                Purge File
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </SubscriptionGate>

      {/* Quick Adjust Paper Stock Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Adjust Paper Tray Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Update the current remaining physical sheets in your print center trays. Low stock alerts will trigger when A4 falls below 100 sheets.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  A4 Paper Stock (Sheets):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={stockInputA4}
                    onChange={(e) => setStockInputA4(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-dark border border-surface-border text-white text-sm focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="text-xs text-slate-400">
                    ≈ {Math.round((stockInputA4 / 500) * 10) / 10} reams
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  A3 Paper Stock (Sheets):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={stockInputA3}
                    onChange={(e) => setStockInputA3(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-dark border border-surface-border text-white text-sm focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <span className="text-xs text-slate-400">sheets</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-surface-border text-slate-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStock}
                disabled={isUpdatingStock}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow disabled:opacity-50"
              >
                {isUpdatingStock ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Inventory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

