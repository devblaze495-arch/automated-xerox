'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { SubscriptionGate } from '@/components/SubscriptionGate';
import {
  getOperatorOrders,
  acceptOperatorOrder,
  readyOperatorOrder,
  collectOperatorOrder,
  rejectOperatorOrder,
  getPrinters,
  togglePrinter,
  triggerTestDispatch,
  getConnectedAgents,
  getShopSettings,
  updateShopSettings,
  toggleSpoolerPause,
  bumpOrderPriority,
  reRouteOrderPrinter,
  scanCollectOrder,
  ScanCollectResponse,
  logWalkInOrder,
} from '@/lib/api';
import { EnrichedOperatorOrder, PrinterDevice, ConnectedAgentInfo, ShopSettings } from '@/lib/types';
import {
  Printer,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ArrowUpCircle,
  Check,
  RefreshCw,
  Send,
  Zap,
  Clock,
  ShieldCheck,
  Search,
  Power,
  XCircle,
  Layers,
  Sparkles,
  BarChart3,
  Sliders,
  Store,
  QrCode,
  ScanLine,
  Camera,
  X,
  UserPlus,
  Receipt,
} from 'lucide-react';

export default function OperatorDashboardPage() {
  const [orders, setOrders] = useState<EnrichedOperatorOrder[]>([]);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [agents, setAgents] = useState<ConnectedAgentInfo[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'READY' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyOtpInput, setVerifyOtpInput] = useState<{ [orderId: string]: string }>({});
  const [selectedPrinters, setSelectedPrinters] = useState<{ [orderId: string]: string }>({});
  const [togglingPrinterId, setTogglingPrinterId] = useState<string | null>(null);

  // Shop settings & rates
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<ShopSettings>>({});

  // Auto-Print Pause (Walk-in Mode) & Priority Bump state
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [bumpingOrderId, setBumpingOrderId] = useState<string | null>(null);
  const isSpoolerPaused = shopSettings?.isSpoolerPaused ?? false;

  // Instant Counter Scanner & Handover state
  const [scanInput, setScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastCollectedOrder, setLastCollectedOrder] = useState<ScanCollectResponse['order'] | null>(null);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);
  const html5QrCodeRef = React.useRef<any>(null);

  // Quick Walk-in Counter Logging state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInPaperSize, setWalkInPaperSize] = useState<'A4' | 'A3'>('A4');
  const [walkInColorMode, setWalkInColorMode] = useState<'BW' | 'COLOR'>('BW');
  const [walkInSheets, setWalkInSheets] = useState(1);
  const [walkInAmount, setWalkInAmount] = useState(2.0);
  const [walkInNote, setWalkInNote] = useState('');
  const [isLoggingWalkIn, setIsLoggingWalkIn] = useState(false);

  // Auto-calculate walk-in estimated rate based on center rates
  useEffect(() => {
    if (!shopSettings) return;
    const baseRate = walkInColorMode === 'COLOR' ? shopSettings.colorRatePerSheet : shopSettings.bwRatePerSheet;
    const multiplier = walkInPaperSize === 'A3' ? shopSettings.a3Multiplier : 1.0;
    const calculated = walkInSheets * baseRate * multiplier;
    setWalkInAmount(Math.round(calculated * 100) / 100);
  }, [walkInSheets, walkInPaperSize, walkInColorMode, shopSettings]);

  // Poll orders & agents every 3 seconds
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [ordersData, printersData, agentsData, settingsData] = await Promise.all([
          getOperatorOrders().catch(() => []),
          getPrinters().catch(() => []),
          getConnectedAgents().catch(() => ({ totalConnected: 0, agents: [] })),
          getShopSettings().catch(() => null),
        ]);

        if (isMounted) {
          setOrders(ordersData);
          if (printersData.length > 0) {
            setPrinters(printersData);
          }
          setAgents(agentsData.agents || []);
          if (settingsData) {
            setShopSettings(settingsData);
          }
          setIsLoadingOrders(false);
        }
      } catch (err: any) {
        console.warn('Operator data fetch error:', err);
      }
    }

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleTestDispatch = async () => {
    setIsDispatchingTest(true);
    setDispatchFeedback(null);
    try {
      const res = await triggerTestDispatch('CTR-CAMPUS-01');
      setDispatchFeedback(res.message);
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      setDispatchFeedback(err.message || 'Failed to dispatch test job');
    } finally {
      setIsDispatchingTest(false);
    }
  };

  const handleTogglePrinter = async (printerId: string) => {
    setTogglingPrinterId(printerId);
    try {
      const updated = await togglePrinter(printerId);
      setPrinters((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle printer status');
    } finally {
      setTogglingPrinterId(null);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const targetPrinterId = selectedPrinters[orderId];
      await acceptOperatorOrder(orderId, targetPrinterId);
      setDispatchFeedback(`Order #${orderId.substring(0, 8)} accepted & dispatched to spooler!`);
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to accept order');
    }
  };

  const handleReRoutePrinter = async (orderId: string, targetPrinterName: string) => {
    try {
      const res = await reRouteOrderPrinter(orderId, targetPrinterName);
      setDispatchFeedback(`🔀 ${res.message || `Order #${orderId.substring(0, 8)} re-routed to ${targetPrinterName}`}`);
      setSelectedPrinters((prev) => ({ ...prev, [orderId]: targetPrinterName }));
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to re-route order printer');
    }
  };

  const handleReadyOrder = async (orderId: string) => {
    try {
      await readyOperatorOrder(orderId);
      setDispatchFeedback(`Order #${orderId.substring(0, 8)} marked ready for student pickup.`);
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to mark order ready');
    }
  };

  const handleVerifyOtp = async (order: EnrichedOperatorOrder) => {
    const inputOtp = verifyOtpInput[order.id]?.trim();
    if (!inputOtp) {
      alert('Please enter the student\'s 4-digit Collection OTP.');
      return;
    }

    try {
      await collectOperatorOrder(order.id, inputOtp);
      setDispatchFeedback(`✅ OTP verified! Order #${order.id.substring(0, 8)} successfully collected.`);
      setVerifyOtpInput((prev) => ({ ...prev, [order.id]: '' }));
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Invalid Collection OTP');
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Enter cancellation / refund reason for this student:', 'Equipment maintenance / paper out');
    if (reason === null) return;

    try {
      const res = await rejectOperatorOrder(orderId, reason);
      setDispatchFeedback(`Order #${orderId.substring(0, 8)} rejected. Simulated refund ID: ${res.refundId}`);
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to reject order');
    }
  };

  const handleToggleShopOpen = async () => {
    if (!shopSettings) return;
    try {
      const updated = await updateShopSettings({ isOpen: !shopSettings.isOpen });
      setShopSettings(updated);
      setDispatchFeedback(`Campus Print Center status set to: ${updated.isOpen ? 'OPEN' : 'CLOSED'}`);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle shop status');
    }
  };

  const handleOpenSettingsModal = () => {
    if (shopSettings) {
      setSettingsForm({ ...shopSettings });
    }
    setIsSettingsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const updated = await updateShopSettings(settingsForm);
      setShopSettings(updated);
      setIsSettingsModalOpen(false);
      setDispatchFeedback('Shop settings, pricing rates, and paper stock updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update shop settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleSpoolerPause = async () => {
    setIsTogglingPause(true);
    try {
      const nextState = !isSpoolerPaused;
      const res = await toggleSpoolerPause('CTR-CAMPUS-01', nextState);
      setShopSettings((prev) => (prev ? { ...prev, isSpoolerPaused: res.paused } : null));
      setDispatchFeedback(
        res.paused
          ? '⏸️ Spooler PAUSED: Hardware print jobs held. Walk-in queue priority active.'
          : `▶️ Spooler RESUMED: Hardware printing restarted. ${res.flushedCount ?? 0} held jobs dispatched!`
      );
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle spooler pause status');
    } finally {
      setIsTogglingPause(false);
    }
  };

  const handleBumpPriority = async (orderId: string) => {
    setBumpingOrderId(orderId);
    try {
      await bumpOrderPriority(orderId, true);
      setDispatchFeedback(`⚡ Order #${orderId.substring(0, 8)} bumped to TOP PRIORITY in print queue!`);
      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      alert(err.message || 'Failed to bump order priority');
    } finally {
      setBumpingOrderId(null);
    }
  };

  // Synthesizes a pleasant ascending audio chime upon verified pickup handover
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 major triad
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.36);
      });
    } catch (_e) {
      // Audio playback can fail silently if user interaction is not registered yet
    }
  };

  // Quick Walk-in Counter Logging
  const handleLogWalkIn = async () => {
    if (walkInSheets <= 0) {
      alert('Sheets must be at least 1');
      return;
    }
    setIsLoggingWalkIn(true);
    try {
      const centerId = shopSettings?.id || 'CTR-CAMPUS-01';
      const res = await logWalkInOrder({
        centerId,
        paperSize: walkInPaperSize,
        sheets: walkInSheets,
        colorMode: walkInColorMode,
        amountCollected: walkInAmount,
        note: walkInNote || undefined,
      });

      playSuccessChime();
      setIsWalkInModalOpen(false);
      setWalkInNote('');
      setWalkInSheets(1);

      setDispatchFeedback(`✅ ${res.message}`);

      const [freshOrders, freshSettings] = await Promise.all([
        getOperatorOrders(),
        getShopSettings().catch(() => null),
      ]);
      setOrders(freshOrders);
      if (freshSettings) setShopSettings(freshSettings);
    } catch (err: any) {
      alert(err.message || 'Failed to log walk-in order');
    } finally {
      setIsLoggingWalkIn(false);
    }
  };

  // Keyboard shortcut '/' to auto-focus counter scan bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement !== scanInputRef.current &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        scanInputRef.current?.focus();
        scanInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Instant Counter Scan Collection Handler
  const executeScanCollect = async (raw?: string) => {
    const input = (raw !== undefined ? raw : scanInput).trim();
    if (!input || isProcessingScan) return;

    setIsProcessingScan(true);
    setScanError(null);

    try {
      const centerId = shopSettings?.id || 'CTR-CAMPUS-01';
      const result = await scanCollectOrder(centerId, input);

      playSuccessChime();
      setLastCollectedOrder(result.order);
      setScanInput('');

      // Auto-dismiss handover celebration after 4 seconds
      setTimeout(() => {
        setLastCollectedOrder((current) => (current?.id === result.order.id ? null : current));
      }, 4000);

      const freshOrders = await getOperatorOrders();
      setOrders(freshOrders);
    } catch (err: any) {
      setScanError(err.message || 'Scan verification failed. Check OTP or QR.');
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleScanInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScanInput(val);
    setScanError(null);

    // If a full QR payload is typed/pasted by USB scanner wedge, auto-submit immediately!
    if (val.startsWith('CAMPUSPRINT_PICKUP:') && val.split(':').length >= 3) {
      executeScanCollect(val);
    }
  };

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeScanCollect();
    }
  };

  // Webcam QR scanner modal lifecycle with html5-qrcode
  useEffect(() => {
    if (!isCameraScannerOpen) return;

    let qrScanner: any = null;
    let isCancelled = false;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (isCancelled) return;
        qrScanner = new Html5Qrcode('camera-reader');
        html5QrCodeRef.current = qrScanner;

        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            if (qrScanner?.isScanning) {
              qrScanner
                .stop()
                .catch(() => {})
                .finally(() => {
                  setIsCameraScannerOpen(false);
                  executeScanCollect(decodedText);
                });
            }
          },
          () => {}
        );
      } catch (err: any) {
        setScanError(`Camera error: ${err.message || 'Unable to access camera'}`);
        setIsCameraScannerOpen(false);
      }
    }

    startScanner();

    return () => {
      isCancelled = true;
      if (qrScanner && qrScanner.isScanning) {
        qrScanner
          .stop()
          .catch(() => {})
          .finally(() => {
            qrScanner.clear();
          });
      }
    };
  }, [isCameraScannerOpen]);

  // Filtered queue
  const filteredOrders = orders.filter((order) => {
    const matchesFilter =
      activeFilter === 'ALL' ||
      (activeFilter === 'ACTIVE' &&
        (order.status === 'PAYMENT_VERIFIED' ||
          order.status === 'WAITING_FOR_OPERATOR' ||
          order.status === 'QUEUED' ||
          order.status === 'PRINTING')) ||
      (activeFilter === 'READY' && order.status === 'READY_FOR_COLLECTION') ||
      (activeFilter === 'COMPLETED' && (order.status === 'COLLECTED' || order.status === 'COMPLETED'));

    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.studentName && order.studentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      order.collectionOtp.includes(searchQuery) ||
      order.items.some((i) => i.documentName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <SubscriptionGate>
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Operator Workbench Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-2">
              <Zap className="h-3.5 w-3.5" />
              Peak-Hours High Throughput Mode
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Xerox Centre Operator Workbench
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Terminal: <strong className="text-white">Central Library Print Station (CTR-CAMPUS-01)</strong>
            </p>
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Shop Status Toggle */}
            <button
              type="button"
              onClick={handleToggleShopOpen}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                shopSettings?.isOpen
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
              }`}
              title="Click to toggle shop Open/Closed status"
            >
              <Store className="h-4 w-4" />
              <span>Shop: {shopSettings?.isOpen ? 'OPEN' : 'CLOSED'}</span>
            </button>

            {/* Auto-Print Spooler Pause (Walk-in Mode) */}
            <button
              type="button"
              onClick={handleToggleSpoolerPause}
              disabled={isTogglingPause}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                isSpoolerPaused
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 animate-pulse hover:bg-amber-500/25'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              }`}
              title="Toggle Auto-Print / Walk-in Mode"
            >
              {isSpoolerPaused ? <Pause className="h-4 w-4 text-amber-400" /> : <Play className="h-4 w-4" />}
              <span>{isSpoolerPaused ? 'Auto-Print: PAUSED (Walk-in Mode)' : 'Auto-Print: RUNNING'}</span>
            </button>

            {/* Analytics Link */}
            <Link
              href="/operator/analytics"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
              title="View revenue, paper consumption & privacy ledger"
            >
              <BarChart3 className="h-4 w-4 text-brand-400" />
              <span>Analytics & Ledger</span>
            </Link>

            {/* Counter QR Poster Link */}
            <Link
              href="/operator/poster"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
              title="Print counter QR standee for student onboarding"
            >
              <QrCode className="h-4 w-4 text-emerald-400" />
              <span>Counter QR Standee</span>
            </Link>

            {/* Rates & Stock Settings */}
            <button
              type="button"
              onClick={handleOpenSettingsModal}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-surface-border bg-surface-card hover:bg-surface-elevated text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-sm"
              title="Configure per-sheet rates and paper stock"
            >
              <Sliders className="h-4 w-4 text-blue-400" />
              <span>Rates & Stock</span>
            </button>

            {/* Quick Walk-in Log Button */}
            <button
              type="button"
              onClick={() => setIsWalkInModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition-all shadow-sm"
              title="Log cash counter or pen-drive walk-in print"
            >
              <UserPlus className="h-4 w-4 text-emerald-400" />
              <span>+ Log Walk-in</span>
            </button>

            {/* Quick Dispatch Button */}
            <button
              type="button"
              onClick={handleTestDispatch}
              disabled={isDispatchingTest}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-md shrink-0"
            >
              {isDispatchingTest ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Test Dispatch
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {dispatchFeedback && (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center justify-between">
            <span>{dispatchFeedback}</span>
            <button
              onClick={() => setDispatchFeedback(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Handover Celebration Toast Banner (4-second auto-dismiss) */}
        {lastCollectedOrder && (
          <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-emerald-900/70 to-emerald-950/90 border-2 border-emerald-500 shadow-2xl shadow-emerald-950/60 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-7 w-7 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Verified Pickup Handover
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Order #{lastCollectedOrder.shortId}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-0.5">
                  Handed over to <span className="text-emerald-300">{lastCollectedOrder.studentName}</span>
                </h3>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  {lastCollectedOrder.totalSheets} sheets printed · ₹{lastCollectedOrder.amountPaid.toFixed(2)} collected · Auto-purged document privacy data
                </p>
              </div>
            </div>
            <button
              onClick={() => setLastCollectedOrder(null)}
              className="p-2 rounded-xl hover:bg-emerald-800/40 text-slate-400 hover:text-white transition-all shrink-0"
              title="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Instant Counter Scan Bar (USB Wedge + 4-Digit OTP + Camera Scanner) */}
        <div className="rounded-2xl border border-surface-border bg-surface-card p-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <ScanLine className="h-5 w-5 text-brand-400" />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={handleScanInputChange}
                onKeyDown={handleScanKeyDown}
                placeholder="Scan Student QR Ticket or Enter 4-Digit OTP... (Press / to focus)"
                disabled={isProcessingScan}
                className="w-full pl-11 pr-28 py-3 rounded-xl bg-surface-dark border border-surface-border text-white placeholder-slate-500 font-mono text-sm sm:text-base focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
              <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-surface-elevated border border-surface-border rounded shadow-sm">
                  /
                </kbd>
                <button
                  type="button"
                  onClick={() => executeScanCollect()}
                  disabled={!scanInput.trim() || isProcessingScan}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  {isProcessingScan ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Handover</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCameraScannerOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-surface-border bg-surface-elevated hover:bg-surface-elevated/80 text-slate-200 hover:text-white text-xs sm:text-sm font-semibold transition-all shrink-0 shadow-sm"
              title="Open Webcam to scan student screen"
            >
              <Camera className="h-4 w-4 text-emerald-400" />
              <span>Scan via Camera</span>
            </button>
          </div>

          {scanError && (
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{scanError}</span>
              </div>
              <button
                onClick={() => setScanError(null)}
                className="text-rose-400/80 hover:text-rose-300 font-bold ml-2"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Hardware Status Banner & Printer Control Bar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Printer className="h-4 w-4 text-brand-400" />
              Physical Printer Engines & Routing Registry
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {printers.filter((p) => p.isOnline).length} / {printers.length} online
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {printers.map((printer) => (
              <div
                key={printer.id}
                className={`rounded-2xl border p-4 transition-all ${
                  printer.isOnline
                    ? 'border-surface-border bg-surface-card hover:border-slate-600'
                    : 'border-rose-500/30 bg-surface-dark opacity-75'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          printer.isOnline
                            ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                            : 'bg-rose-500'
                        }`}
                      />
                      <h3 className="font-bold text-white text-sm">{printer.name}</h3>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Port: {printer.portName}</p>
                  </div>

                  {/* Toggle Online / Offline */}
                  <button
                    type="button"
                    onClick={() => handleTogglePrinter(printer.id)}
                    disabled={togglingPrinterId === printer.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      printer.isOnline
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-300 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-rose-500/30'
                    }`}
                    title={printer.isOnline ? 'Click to set offline' : 'Click to set online'}
                  >
                    <Power className="h-3 w-3" />
                    {togglingPrinterId === printer.id ? '...' : printer.isOnline ? 'ONLINE' : 'OFFLINE'}
                  </button>
                </div>

                {/* Live Queue Load & Spooler Telemetry Badge */}
                <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px]">
                  {printer.status === 'PAPER_OUT' ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      PAPER OUT · 0 jobs
                    </span>
                  ) : !printer.isOnline || printer.status === 'OFFLINE' ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      OFFLINE
                    </span>
                  ) : printer.status === 'ERROR' ? (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-rose-400" />
                      ERROR
                    </span>
                  ) : (printer.queuedJobs ?? printer.currentQueueCount ?? 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                      <Clock className="h-3 w-3 text-amber-400" />
                      BUSY · {printer.queuedJobs ?? printer.currentQueueCount} jobs ({printer.queuedPages ?? ((printer.queuedJobs ?? printer.currentQueueCount) * 2)} pgs)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-400" />
                      ONLINE · 0 jobs
                    </span>
                  )}
                </div>

                {/* Capabilities Badges */}
                <div className="mt-3 flex flex-wrap gap-1 text-[10px] font-mono">
                  {printer.capabilities.a4 && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-dark text-slate-300 border border-surface-border">
                      A4
                    </span>
                  )}
                  {printer.capabilities.a3 && (
                    <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/40 font-bold">
                      A3 Large
                    </span>
                  )}
                  {printer.capabilities.color ? (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Color
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-surface-dark text-slate-400 border border-surface-border">
                      B&W Only
                    </span>
                  )}
                  {printer.capabilities.autoDuplex ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Auto-Duplex
                    </span>
                  ) : printer.capabilities.manualDuplex ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Manual Duplex
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-surface-dark text-slate-500 border border-surface-border">
                      Simplex
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Queue Cards */}
        <div className="rounded-3xl border border-surface-border bg-surface-card p-6 shadow-xl space-y-6">
          {/* Walk-in Mode / Spooler Paused Warning Banner */}
          {isSpoolerPaused && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-300 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 animate-bounce" />
                <div className="text-xs">
                  <strong className="text-amber-200">Auto-Print Paused (Walk-in Priority Mode)</strong> — Incoming student orders are safely held in the cloud queue while your physical printers serve walk-in customers. Click <button type="button" onClick={handleToggleSpoolerPause} className="underline font-bold text-amber-300 hover:text-white">Auto-Print: PAUSED</button> above to resume hardware printing.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleSpoolerPause}
                disabled={isTogglingPause}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shrink-0 transition shadow"
              >
                Resume Auto-Print
              </button>
            </div>
          )}

          {/* Controls: Search & Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-surface-dark border border-surface-border p-1 rounded-xl text-xs font-medium">
              {(['ALL', 'ACTIVE', 'READY', 'COMPLETED'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    activeFilter === filter
                      ? 'bg-brand-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter} (
                  {filter === 'ALL'
                    ? orders.length
                    : orders.filter((q) =>
                        filter === 'ACTIVE'
                          ? q.status === 'PAYMENT_VERIFIED' ||
                            q.status === 'WAITING_FOR_OPERATOR' ||
                            q.status === 'QUEUED' ||
                            q.status === 'PRINTING'
                          : filter === 'READY'
                          ? q.status === 'READY_FOR_COLLECTION'
                          : q.status === 'COLLECTED' || q.status === 'COMPLETED'
                      ).length}
                  )
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[260px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search OTP, Order ID, or Student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface-dark border border-surface-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          {/* Queue Cards */}
          <div className="space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No orders match your filter criteria.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isDuplex = order.items.some((i) => i.duplexMode !== 'SIMPLEX');
                const requiresManualFlip = order.requiresManualFlip;
                const assignedPrinter = printers.find((p) => p.id === order.assignedPrinterId);

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-surface-border bg-surface-dark p-4 sm:p-5 transition-all hover:border-slate-600"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Column: Order Header & Items */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            #{order.id.substring(0, 8)}
                          </span>
                          {order.isUrgent && (
                            <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-extrabold text-[10px] tracking-wider animate-pulse flex items-center gap-1 shadow-sm">
                              <Zap className="h-3 w-3 fill-current" />
                              URGENT
                            </span>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="text-xs font-semibold text-slate-300">
                            {order.studentName || 'Student'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs text-slate-400 font-mono">{order.studentPhone}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="font-bold text-white font-mono text-xs">
                            ₹{(order.totalAmountCents / 100).toFixed(2)}
                          </span>
                        </div>

                        {/* Document Items List */}
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={item.id} className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white truncate max-w-xs">
                                {idx + 1}. {item.documentName}
                              </span>
                              <span className="text-slate-400 font-mono">({item.totalPages} pgs)</span>
                              <span className="px-1.5 py-0.2 rounded bg-surface-card border border-surface-border font-mono text-[10px]">
                                {item.colorMode}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-surface-card border border-surface-border font-mono text-[10px]">
                                {item.paperSize}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-surface-card border border-surface-border font-mono text-[10px]">
                                {item.duplexMode}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-surface-card border border-surface-border font-mono text-[10px]">
                                {item.copies} cop
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Badges: Total Sheets + Assigned/Compatible Printer */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                          <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/40 font-bold">
                            {order.totalSheets} Total Physical Sheets
                          </span>

                          {/* Auto-Selected Printer Badge & Manual Switcher Dropdown */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm text-xs font-mono font-semibold">
                              <Printer className="h-3.5 w-3.5 text-emerald-400" />
                              <span>
                                {assignedPrinter
                                  ? `Auto-Routed: ${assignedPrinter.name}`
                                  : order.assignedPrinterName
                                  ? `Auto-Routed: ${order.assignedPrinterName}`
                                  : 'Auto-Routing to Best Engine'}
                              </span>
                            </span>

                            {/* Manual Printer Re-Route Switcher for Queued / Active Orders */}
                            {(order.status === 'PAYMENT_VERIFIED' ||
                              order.status === 'WAITING_FOR_OPERATOR' ||
                              order.status === 'QUEUED') && (
                              <div className="flex items-center gap-1.5 text-xs font-sans">
                                <span className="text-slate-400 text-[11px] font-mono">Switch:</span>
                                <select
                                  value={assignedPrinter?.name || order.assignedPrinterName || ''}
                                  onChange={(e) => handleReRoutePrinter(order.id, e.target.value)}
                                  className="px-2 py-1 rounded-lg bg-surface-card border border-surface-border text-white text-xs focus:outline-none focus:border-brand-500 font-mono"
                                  title="Manually switch the target physical printer engine"
                                >
                                  {printers.map((p) => (
                                    <option key={p.id} value={p.name}>
                                      {p.name} ({p.portName}) {p.status ? `[${p.status}]` : p.isOnline ? '[ONLINE]' : '[OFFLINE]'}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Manual Paper Flip Required Warning */}
                          {requiresManualFlip && (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                              Manual Paper Flip Required (G2010 Duplex)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: 4-Digit OTP Hero Badge */}
                      <div className="flex lg:flex-col items-center lg:items-center justify-between p-3 rounded-2xl bg-surface-card border border-surface-border min-w-[140px] text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Collection OTP</span>
                        <span className="text-2xl font-black font-mono tracking-widest text-emerald-400 my-0.5">
                          {order.collectionOtp}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.2 rounded font-bold ${
                            order.status === 'READY_FOR_COLLECTION'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : order.status === 'PRINTING'
                              ? 'bg-brand-500/20 text-brand-300'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>

                      {/* Right Column: Operator Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!order.isUrgent &&
                          (order.status === 'PAYMENT_VERIFIED' ||
                            order.status === 'WAITING_FOR_OPERATOR' ||
                            order.status === 'QUEUED') && (
                            <button
                              type="button"
                              onClick={() => handleBumpPriority(order.id)}
                              disabled={bumpingOrderId === order.id}
                              className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                              title="Bump this order to the top of the print queue"
                            >
                              <ArrowUpCircle className="h-3.5 w-3.5 text-amber-400" />
                              {bumpingOrderId === order.id ? 'Bumping...' : 'Bump to Top'}
                            </button>
                          )}

                        {(order.status === 'PAYMENT_VERIFIED' ||
                          order.status === 'WAITING_FOR_OPERATOR' ||
                          order.status === 'QUEUED') && (
                          <button
                            type="button"
                            onClick={() => handleAcceptOrder(order.id)}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Dispatch to Printer
                          </button>
                        )}

                        {order.status === 'PRINTING' && (
                          <button
                            type="button"
                            onClick={() => handleReadyOrder(order.id)}
                            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Mark Ready
                          </button>
                        )}

                        {order.status === 'READY_FOR_COLLECTION' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="4-digit OTP"
                              value={verifyOtpInput[order.id] || ''}
                              onChange={(e) =>
                                setVerifyOtpInput((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="w-24 px-2.5 py-1.5 text-center font-mono font-bold text-xs rounded-xl bg-surface-card border border-surface-border text-white focus:outline-none focus:border-emerald-500 placeholder-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleVerifyOtp(order)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Verify OTP & Collect
                            </button>
                          </div>
                        )}

                        {(order.status === 'COLLECTED' || order.status === 'COMPLETED') && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Collected
                          </span>
                        )}

                        {order.status !== 'COLLECTED' && order.status !== 'COMPLETED' && order.status !== 'REFUNDED' && (
                          <button
                            type="button"
                            onClick={() => handleRejectOrder(order.id)}
                            className="px-2.5 py-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs transition-colors flex items-center gap-1"
                            title="Reject and trigger immediate student refund"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject & Refund
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
      </SubscriptionGate>

      {/* Shop Rates & Stock Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-surface-card border border-surface-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Campus Print Center Settings</h3>
                  <p className="text-xs text-slate-400">Manage station status, per-sheet pricing rates, and paper stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Shop Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-dark border border-surface-border">
                <div>
                  <div className="text-xs font-bold text-white">Station Open Status</div>
                  <div className="text-[11px] text-slate-400">Control student order acceptance at this station</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSettingsForm((prev) => ({ ...prev, isOpen: !prev.isOpen }))
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    settingsForm.isOpen
                      ? 'bg-emerald-500 text-white'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {settingsForm.isOpen ? 'OPEN' : 'CLOSED'}
                </button>
              </div>

              {/* Privacy Auto-Delete on Collection */}
              <div className="flex items-start justify-between p-3 rounded-xl bg-surface-dark border border-surface-border gap-3">
                <div>
                  <div className="text-xs font-bold text-white">Auto-Delete PDF on Collection</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Permanently purges physical PDF file blobs upon OTP collection for student privacy. Accounting and sheet aggregates are retained.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settingsForm.autoDeleteOnCollection ?? true}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      autoDeleteOnCollection: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 rounded border-surface-border text-brand-600 focus:ring-brand-500"
                />
              </div>

              {/* Rate Card Settings */}
              <div className="p-3.5 rounded-xl bg-surface-dark border border-surface-border space-y-3">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Per-Sheet Pricing Rates
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      B&W Rate (₹/sheet)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={settingsForm.bwRatePerSheet ?? 2.0}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          bwRatePerSheet: parseFloat(e.target.value) || 2.0,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Color Rate (₹/sheet)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1.0"
                      value={settingsForm.colorRatePerSheet ?? 10.0}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          colorRatePerSheet: parseFloat(e.target.value) || 10.0,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      A3 Multiplier (x)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      value={settingsForm.a3Multiplier ?? 2.0}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          a3Multiplier: parseFloat(e.target.value) || 2.0,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Paper Tray Stock */}
              <div className="p-3.5 rounded-xl bg-surface-dark border border-surface-border space-y-3">
                <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Paper Inventory Stock
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      A4 Tray Stock (Sheets)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settingsForm.paperStockA4 ?? 500}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          paperStockA4: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      A3 Tray Stock (Sheets)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settingsForm.paperStockA3 ?? 100}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          paperStockA3: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-surface-card border border-surface-border text-white text-xs font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-surface-border text-slate-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webcam QR Scanner Viewfinder Modal */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-surface-card border border-surface-border shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Scan Student QR Code</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Hold the student's phone screen up to the camera. The scanner will automatically detect the pickup pass and complete the handover.
            </p>

            {/* html5-qrcode target container */}
            <div className="overflow-hidden rounded-xl bg-black border border-surface-border relative">
              <div id="camera-reader" className="w-full min-h-[280px]" />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-surface-border text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Walk-in Customer Logging Modal */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-surface-card border border-surface-border shadow-2xl p-6 overflow-hidden space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Log Walk-in Customer</h3>
                  <p className="text-[11px] text-slate-400">Counter / Pen-drive print job</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Paper Size & Color Mode Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Paper Size
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-dark border border-surface-border">
                    <button
                      type="button"
                      onClick={() => setWalkInPaperSize('A4')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        walkInPaperSize === 'A4'
                          ? 'bg-brand-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalkInPaperSize('A3')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        walkInPaperSize === 'A3'
                          ? 'bg-brand-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      A3
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Stock: {walkInPaperSize === 'A3' ? (shopSettings?.paperStockA3 ?? 0) : (shopSettings?.paperStockA4 ?? 0)} left
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Color Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-dark border border-surface-border">
                    <button
                      type="button"
                      onClick={() => setWalkInColorMode('BW')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        walkInColorMode === 'BW'
                          ? 'bg-slate-700 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      B&W
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalkInColorMode('COLOR')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        walkInColorMode === 'COLOR'
                          ? 'bg-brand-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Color
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Rate: ₹{walkInColorMode === 'COLOR' ? (shopSettings?.colorRatePerSheet ?? 10) : (shopSettings?.bwRatePerSheet ?? 2)}/sheet
                  </span>
                </div>
              </div>

              {/* Sheets and Amount Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Sheets Printed
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={walkInSheets}
                    onChange={(e) => setWalkInSheets(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl bg-surface-dark border border-surface-border text-white text-sm font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Amount Collected (₹)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={walkInAmount}
                    onChange={(e) => setWalkInAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-dark border border-surface-border text-emerald-400 font-bold text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Note / Customer description */}
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  Job Description / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pen-drive resume print, 2x spiral bind"
                  value={walkInNote}
                  onChange={(e) => setWalkInNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-dark border border-surface-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-surface-border text-slate-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogWalkIn}
                disabled={isLoggingWalkIn}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all"
              >
                {isLoggingWalkIn ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Log & Deduct Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
