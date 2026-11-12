'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Store,
  ArrowRight,
  Printer,
  ChevronRight,
  ExternalLink,
  Layers,
} from 'lucide-react';

function DownloadContent() {
  const searchParams = useSearchParams();
  const centerCode = searchParams.get('center') || 'CTR-CAMPUS-01';

  // Format shop name based on known campus stations or fallback
  const getCenterDisplayName = (code: string) => {
    switch (code.toUpperCase()) {
      case 'CTR-CAMPUS-01':
        return 'Central Library Print Station';
      case 'CTR-GIT-01':
        return 'Engineering Block A Xerox Centre';
      case 'CTR-HOSTEL-02':
        return 'Hostel Campus Express Print Hub';
      default:
        return code.startsWith('CTR-') ? `${code} Print Station` : `${code}`;
    }
  };

  const centerName = getCenterDisplayName(centerCode);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Top Banner Accent */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-20 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1">
                Campus<span className="text-blue-500">Print</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium block">
                Direct Express Student Printing
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>v1.0 Ready</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 flex flex-col items-center justify-center space-y-6">
        {/* Linked Shop Badge */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Target Print Station
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white">
                {centerName}
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-slate-800 text-blue-400 border border-slate-700 px-2.5 py-1 rounded-lg shrink-0">
            {centerCode}
          </span>
        </div>

        {/* Hero Card */}
        <div className="w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-blue-600/20 blur-3xl rounded-full pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
            <Zap className="h-3.5 w-3.5" />
            <span>Native Android App • 1.43 MB</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Install CampusPrint
          </h1>

          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Upload PDFs from your phone, pay with UPI, and pick up your documents instantly with a 4-digit OTP.
          </p>

          {/* Primary CTA Button */}
          <a
            href="/download/CampusPrint.apk"
            download="CampusPrint.apk"
            className="w-full inline-flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-base shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all transform active:scale-[0.99]"
          >
            <Download className="h-5 w-5" />
            <span>Download CampusPrint (1.43 MB APK)</span>
          </a>

          <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Direct Hardware Spool
            </span>
            <span>•</span>
            <span>Android 8.0+</span>
            <span>•</span>
            <span>Zero Pre-paid Wallets</span>
          </div>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="w-full bg-slate-900/70 border border-slate-800/90 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-brand-400" />
            <span>Quick 3-Step Installation Guide</span>
          </h3>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Tap Download APK</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The lightweight 1.43 MB package downloads directly to your device within seconds.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Allow Browser Installation</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tap the downloaded file. If Chrome/browser prompts, tap <strong>&quot;Settings&quot;</strong> and toggle <strong>&quot;Allow from this source&quot;</strong> (or tap &quot;Install Anyway&quot;).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
              <span className="w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">Open & Print</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Launch CampusPrint! Your counter shop (<strong className="text-slate-300">{centerCode}</strong>) will be ready, or scan the counter standee QR to lock in your station.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Cards */}
        <div className="w-full grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-left">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
              ⚡ Instant UPI Pay
            </span>
            <p className="text-[11px] text-slate-400">
              Direct checkout with GPay, PhonePe, Paytm, or BHIM. No recharges needed.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-left">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-1">
              🔒 100% Privacy Purge
            </span>
            <p className="text-[11px] text-slate-400">
              Documents are automatically purged from disk once verified and collected.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[11px] text-slate-500 pt-4">
          Campus Print Platform • Central Library & Satellite Stations • Zero-Queue Printing
        </footer>
      </main>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-sm font-semibold">
          Loading CampusPrint distribution...
        </div>
      }
    >
      <DownloadContent />
    </Suspense>
  );
}

