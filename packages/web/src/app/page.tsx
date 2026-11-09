'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { DocumentUploader } from '@/components/DocumentUploader';
import { PrintConfigCard } from '@/components/PrintConfigCard';
import { CartDrawer } from '@/components/CartDrawer';
import { UploadedDocument, DocumentPrintConfig } from '@/lib/types';
import { ShoppingBag, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function StudentPortalPage() {
  const [configs, setConfigs] = useState<DocumentPrintConfig[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const handleDocumentUploaded = (doc: UploadedDocument) => {
    // Avoid duplicate additions of identical document ID
    setConfigs((prev) => {
      if (prev.some((c) => c.document.id === doc.id)) return prev;

      const newConfig: DocumentPrintConfig = {
        documentId: doc.id,
        document: doc,
        pageRange: 'ALL',
        colorMode: 'BW',
        paperSize: 'A4',
        duplexMode: 'SIMPLEX',
        copies: 1,
      };
      return [...prev, newConfig];
    });
  };

  const handleConfigUpdate = (updated: DocumentPrintConfig) => {
    setConfigs((prev) =>
      prev.map((c) => (c.document.id === updated.document.id ? updated : c))
    );
  };

  const handleConfigRemove = (documentId: string) => {
    setConfigs((prev) => prev.filter((c) => c.document.id !== documentId));
  };

  const totalSheets = configs.reduce((sum, c) => sum + (c.pricing?.totalSheets || 0), 0);
  const totalAmountCents =
    configs.reduce((sum, c) => sum + (c.pricing?.itemTotalCents || 0), 0) +
    (configs.length > 0 ? 100 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar cartCount={configs.length} onOpenCart={() => setIsCartOpen(true)} />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Banner */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold mb-3">
            <Zap className="h-3.5 w-3.5" />
            Zero-Queue Campus Printing Platform
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Campus Print Ordering & Dispatch Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Upload PDFs, configure per-document color/duplex settings with real-time sheet calculation, and collect via high-speed OTP verification at the campus print station.
          </p>
        </div>

        {/* Two-Column Grid: Uploader on Left, Queue Preview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Action Area */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Upload Documents */}
            <div className="rounded-2xl border border-surface-border bg-surface-dark p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold font-mono">
                    1
                  </span>
                  Upload PDF Documents
                </h2>
                {configs.length > 0 && (
                  <span className="text-xs text-slate-400 font-mono">
                    {configs.length} {configs.length === 1 ? 'file' : 'files'} ready
                  </span>
                )}
              </div>
              <DocumentUploader onDocumentUploaded={handleDocumentUploaded} />
            </div>

            {/* Step 2: Configure Documents */}
            {configs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold font-mono">
                      2
                    </span>
                    Configure Print Options & Live Pricing
                  </h2>
                </div>

                <div className="space-y-4">
                  {configs.map((config, index) => (
                    <PrintConfigCard
                      key={config.document.id}
                      config={config}
                      index={index}
                      onUpdate={handleConfigUpdate}
                      onRemove={handleConfigRemove}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Sidebar: Order Summary Card */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="rounded-2xl border border-surface-border bg-surface-card p-6 shadow-xl">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-brand-400" />
                Live Order Estimate
              </h3>

              {configs.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-dark border border-surface-border text-center text-slate-400 text-xs">
                  <p>Upload one or multiple PDF documents to calculate exact physical paper sheets and cost quote.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span>Total Documents:</span>
                      <span className="font-mono font-semibold text-white">{configs.length}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span>Physical Paper Sheets:</span>
                      <span className="font-mono font-semibold text-white">{totalSheets} sheets</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-surface-border">
                      <span>Queue & Platform Fee:</span>
                      <span className="font-mono font-semibold text-white">₹1.00</span>
                    </div>
                    <div className="flex justify-between pt-2 text-base font-bold text-white">
                      <span>Total Payable:</span>
                      <span className="text-brand-400 font-mono text-xl">
                        ₹{(totalAmountCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCartOpen(true)}
                    className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all shadow-lg shadow-brand-900/30 flex items-center justify-center gap-2 group"
                  >
                    <span>Proceed to Pay</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Collection OTP verified upon physical handover at shop
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </main>

      {/* Cart & Payment Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        configs={configs}
        onClose={() => setIsCartOpen(false)}
      />
    </div>
  );
}
