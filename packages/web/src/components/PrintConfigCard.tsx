'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Trash2,
  Layers,
  Copy,
  Hash,
  Palette,
  FileSpreadsheet,
  RefreshCw,
  FileCheck,
  Check,
} from 'lucide-react';
import { DocumentPrintConfig, ColorMode, PaperSize, DuplexMode, PricingQuote } from '@/lib/types';
import { calculatePricing } from '@/lib/api';

interface PrintConfigCardProps {
  config: DocumentPrintConfig;
  index: number;
  onUpdate: (updated: DocumentPrintConfig) => void;
  onRemove: (documentId: string) => void;
}

export function PrintConfigCard({ config, index, onUpdate, onRemove }: PrintConfigCardProps) {
  const { document } = config;
  const [isCalculating, setIsCalculating] = useState(false);

  // Debounced live pricing calculation whenever configuration changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchPricing() {
      setIsCalculating(true);
      try {
        const quote = await calculatePricing({
          pageCount: document.pageCount,
          pageRange: config.pageRange || 'ALL',
          colorMode: config.colorMode,
          paperSize: config.paperSize,
          duplexMode: config.duplexMode,
          copies: config.copies,
        });

        if (!isCancelled) {
          onUpdate({
            ...config,
            pricing: quote,
            isCalculating: false,
          });
        }
      } catch (err) {
        console.warn('Failed to calculate pricing quote:', err);
      } finally {
        if (!isCancelled) {
          setIsCalculating(false);
        }
      }
    }

    const timer = setTimeout(fetchPricing, 200);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    config.pageRange,
    config.colorMode,
    config.paperSize,
    config.duplexMode,
    config.copies,
    document.pageCount,
  ]);

  const handleFieldChange = <K extends keyof DocumentPrintConfig>(field: K, value: DocumentPrintConfig[K]) => {
    onUpdate({
      ...config,
      [field]: value,
    });
  };

  const pricing = config.pricing;
  const formattedSize = (document.fileSizeBytes / 1024).toFixed(1);
  const impressions = pricing?.impressionsCount ?? pricing?.totalImpressions ?? (pricing?.totalSheets ? pricing.totalSheets * (config.duplexMode === 'SIMPLEX' ? 1 : 2) : 0);
  const paperCost = pricing?.paperCostCents ?? pricing?.basePaperCents ?? 0;
  const tonerCost = pricing?.tonerCostCents ?? pricing?.tonerCents ?? 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-5 sm:p-6 shadow-sm transition-all hover:border-slate-600">
      {/* Top Header: Doc Number, Title, Remove */}
      <div className="flex items-start justify-between gap-3 border-b border-surface-border pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-brand-400">#{index + 1}</span>
              <h3 className="font-semibold text-white text-sm sm:text-base truncate" title={document.fileName}>
                {document.fileName}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="font-medium text-slate-300">{document.pageCount} Pages Total</span>
              <span>•</span>
              <span>{formattedSize} KB</span>
              <span>•</span>
              <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1" title={document.sha256Hash}>
                <FileCheck className="h-3 w-3 text-emerald-400" />
                SHA: {document.sha256Hash.substring(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(document.id)}
          className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          title="Remove document"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-5 border-b border-surface-border">
        {/* Color Mode */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-brand-400" />
            Color Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-dark border border-surface-border">
            <button
              type="button"
              onClick={() => handleFieldChange('colorMode', 'BW')}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                config.colorMode === 'BW'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              B&W
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange('colorMode', 'COLOR')}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                config.colorMode === 'COLOR'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Color
            </button>
          </div>
        </div>

        {/* Duplex Mode (SIMPLEX, DUPLEX_LONG, DUPLEX_SHORT) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-brand-400" />
            Duplex Mode
          </label>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-dark border border-surface-border">
            <button
              type="button"
              onClick={() => handleFieldChange('duplexMode', 'SIMPLEX')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all truncate ${
                config.duplexMode === 'SIMPLEX'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Single-Sided"
            >
              Simplex
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange('duplexMode', 'DUPLEX_LONG')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all truncate ${
                config.duplexMode === 'DUPLEX_LONG'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Double-Sided (Flip on Long Edge)"
            >
              Dup Long
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange('duplexMode', 'DUPLEX_SHORT')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all truncate ${
                config.duplexMode === 'DUPLEX_SHORT'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Double-Sided (Flip on Short Edge / Notepad)"
            >
              Dup Short
            </button>
          </div>
        </div>

        {/* Paper Size */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-brand-400" />
            Paper Size
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-dark border border-surface-border">
            <button
              type="button"
              onClick={() => handleFieldChange('paperSize', 'A4')}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                config.paperSize === 'A4'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A4 Standard
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange('paperSize', 'A3')}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                config.paperSize === 'A3'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A3 Large
            </button>
          </div>
        </div>

        {/* Copies Counter */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Copy className="h-3.5 w-3.5 text-brand-400" />
            Copies
          </label>
          <div className="flex items-center rounded-xl bg-surface-dark border border-surface-border p-1">
            <button
              type="button"
              onClick={() => handleFieldChange('copies', Math.max(1, config.copies - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-elevated hover:text-white transition-colors"
            >
              -
            </button>
            <span className="flex-1 text-center font-mono font-bold text-sm text-white">
              {config.copies}
            </span>
            <button
              type="button"
              onClick={() => handleFieldChange('copies', Math.min(99, config.copies + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-surface-elevated hover:text-white transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Page Range & Detailed Live Pricing Breakdown Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4">
        {/* Page Range Selector */}
        <div className="flex items-center gap-2 max-w-sm">
          <Hash className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 whitespace-nowrap">Page Range:</span>
          <input
            type="text"
            value={config.pageRange}
            onChange={(e) => handleFieldChange('pageRange', e.target.value)}
            placeholder="ALL or 1-5, 8"
            className="w-32 sm:w-44 px-2.5 py-1 text-xs rounded-lg bg-surface-dark border border-surface-border text-white font-mono focus:outline-none focus:border-brand-500"
          />
          {pricing && (
            <span className="text-[11px] text-slate-400 font-mono">
              ({pricing.effectivePages} {pricing.effectivePages === 1 ? 'pg' : 'pgs'})
            </span>
          )}
        </div>

        {/* Live Dynamic Pricing Breakdown */}
        <div className="flex flex-wrap items-center gap-3">
          {pricing ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-300">
                <strong className="text-white">{pricing.totalSheets}</strong> sheets
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-300">
                <strong className="text-white">{impressions}</strong> impr
              </span>
              <span className="text-slate-400 text-[11px]">
                (Paper: ₹{(paperCost / 100).toFixed(2)} + Toner: ₹{(tonerCost / 100).toFixed(2)})
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="text-base font-bold text-brand-400 font-mono">
                ₹{(pricing.itemTotalCents / 100).toFixed(2)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" /> Calculating...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
