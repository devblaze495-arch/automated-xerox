'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  ArrowLeft,
  Sparkles,
  Zap,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Store,
} from 'lucide-react';

export default function OperatorPosterPage() {
  const [centerCode, setCenterCode] = useState('CTR-CAMPUS-01');
  const [centerName, setCenterName] = useState('Central Library Print Station');
  const [downloadDomain, setDownloadDomain] = useState('print.campusprint.local');
  const [bwRate, setBwRate] = useState('₹2.00');
  const [colorRate, setColorRate] = useState('₹10.00');
  const [copied, setCopied] = useState(false);

  // Download URL encoded in the QR code:
  // Points to direct APK download with center pre-selection param
  const downloadUrl = `https://${downloadDomain}/download/CampusPrint.apk?center=${encodeURIComponent(
    centerCode
  )}`;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_err) {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar - Hidden in Print */}
      <header className="no-print border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/operator"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-medium transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Workbench</span>
            </Link>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <Printer className="h-4 w-4 text-brand-400" />
              <span>Printable Counter Onboarding Standee</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied Link' : 'Copy APK URL'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Standee (A4 / A5)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Standee Preview Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col items-center justify-center">
        {/* Settings Bar (Customization) - Hidden in Print */}
        <div className="no-print w-full max-w-2xl mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur text-xs space-y-3">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span>⚙️ Standee Customization</span>
            <span className="text-slate-500">Live preview below</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Center Display Name</label>
              <input
                type="text"
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Center Code</label>
              <input
                type="text"
                value={centerCode}
                onChange={(e) => setCenterCode(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">B/W Rate Display</label>
              <input
                type="text"
                value={bwRate}
                onChange={(e) => setBwRate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Color Rate Display</label>
              <input
                type="text"
                value={colorRate}
                onChange={(e) => setColorRate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PHYSICAL STANDEE POSTER CANVAS (PRINT TARGET) */}
        {/* ============================================================ */}
        <div
          id="print-standee"
          className="w-full max-w-[650px] bg-white text-slate-900 rounded-2xl shadow-2xl border-4 border-slate-900 p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden"
          style={{ minHeight: '800px' }}
        >
          {/* Top Banner Accent */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

          {/* Brand Header */}
          <div className="flex items-center gap-2 mb-2 mt-2">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <Printer className="h-6 w-6" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900 uppercase">
              Campus<span className="text-blue-600">Print</span>
            </span>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-4">
            ⚡ Self-Service Express Printing
          </p>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2">
            Skip the Line. Print Instantly!
          </h2>

          <p className="text-sm text-slate-600 font-medium max-w-md mb-6">
            Upload notes, lab records & assignments from your phone. Pick up your prints in seconds!
          </p>

          {/* Center Identity Card */}
          <div className="w-full max-w-md bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-3 mb-6 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Print Station</span>
              <span className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Store className="h-4 w-4 text-blue-600" />
                {centerName}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Center Code</span>
              <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                {centerCode}
              </span>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xl mb-4 flex flex-col items-center">
            <QRCodeSVG
              value={downloadUrl}
              size={240}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: '',
                x: undefined,
                y: undefined,
                height: 24,
                width: 24,
                excavate: true,
              }}
            />
            <span className="text-[11px] font-mono font-semibold text-slate-500 mt-2">
              Scan to install Android App (1.4 MB)
            </span>
          </div>

          {/* 3 Step Instructions */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-6 text-left">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="inline-block w-5 h-5 rounded-full bg-blue-600 text-white font-black text-center text-xs leading-5 mb-1.5">
                  1
                </span>
                <h4 className="text-xs font-bold text-slate-900">Scan & Install</h4>
                <p className="text-[10px] text-slate-500 mt-1">Open camera, scan QR & get the 1.4MB app.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="inline-block w-5 h-5 rounded-full bg-blue-600 text-white font-black text-center text-xs leading-5 mb-1.5">
                  2
                </span>
                <h4 className="text-xs font-bold text-slate-900">Upload & Pay</h4>
                <p className="text-[10px] text-slate-500 mt-1">Pick PDF, choose B/W or Color, pay via UPI.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="inline-block w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-center text-xs leading-5 mb-1.5">
                  3
                </span>
                <h4 className="text-xs font-bold text-slate-900">Collect with OTP</h4>
                <p className="text-[10px] text-slate-500 mt-1">Show your 4-digit code at counter!</p>
              </div>
            </div>
          </div>

          {/* Pricing & Guarantee Banner */}
          <div className="w-full max-w-lg flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 mb-4">
            <div className="flex items-center gap-1.5">
              <span>📄 B/W: {bwRate} / page</span>
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-700">🎨 Color: {colorRate} / page</span>
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-1 text-[11px] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>100% Private</span>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-slate-400 font-medium mt-auto">
            Campus Print Management System • Central Library • Direct Spooler Integration
          </p>
        </div>
      </main>
    </div>
  );
}

