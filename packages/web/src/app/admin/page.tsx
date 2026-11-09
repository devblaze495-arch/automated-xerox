'use client';

import React from 'react';
import { Navbar } from '@/components/Navbar';
import { Settings, FileSpreadsheet, Palette, Layers, Printer, Shield, Cpu, Database } from 'lucide-react';

export default function AdminPage() {
  const rateCard = {
    paperSheet: [
      { size: 'A4', baseCents: 50, inr: '₹0.50 per sheet' },
      { size: 'A3', baseCents: 120, inr: '₹1.20 per sheet' },
    ],
    toner: [
      { size: 'A4', mode: 'Black & White (BW)', cents: 50, inr: '₹0.50 / impression' },
      { size: 'A4', mode: 'Full Color', cents: 300, inr: '₹3.00 / impression' },
      { size: 'A3', mode: 'Black & White (BW)', cents: 100, inr: '₹1.00 / impression' },
      { size: 'A3', mode: 'Full Color', cents: 600, inr: '₹6.00 / impression' },
    ],
    platformFee: '₹1.00 per order',
  };

  const printers = [
    {
      id: 'prn-g2010',
      name: 'Canon PIXMA G2010',
      model: 'PIXMA G2010 All-in-One Ink Tank',
      connection: 'USB (Local Android / PC Companion Spooler)',
      center: 'Campus Xerox Station A (CTR-CAMPUS-01)',
      capabilities: 'A4 • Color / B&W • High-Yield Ink Tank • Simplex',
      status: 'ONLINE',
    },
    {
      id: 'prn-g3070',
      name: 'Canon PIXMA G3070',
      model: 'PIXMA G3070 Wireless Duplex Ink Tank',
      connection: 'NETWORK_IPP (ipp://192.168.1.110:631)',
      center: 'Central Library Print Hub (CTR-CAMPUS-01)',
      capabilities: 'A4 • Full Color / B&W • Auto Duplex • Wi-Fi IPP',
      status: 'ONLINE',
    },
    {
      id: 'prn-ir2224',
      name: 'Canon imageRUNNER 2224',
      model: 'imageRUNNER 2224 Heavy-Duty Workgroup MFP',
      connection: 'NETWORK_RAW (socket://192.168.1.120:9100)',
      center: 'Administration & Exam Wing (CTR-CAMPUS-02)',
      capabilities: 'A3 / A4 • High-Speed Monochrome (24 ppm) • Auto Duplex • Raw 9100',
      status: 'STANDBY',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold mb-2">
            <Settings className="h-3.5 w-3.5" />
            System Administration
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Rate Card & Hardware Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global pricing rules, physical printer hardware capabilities, and WebSocket gateway configurations.
          </p>
        </div>

        {/* Pricing Matrix */}
        <div className="rounded-3xl border border-surface-border bg-surface-card p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-surface-border pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-brand-400" />
                Deterministic Rate Card Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated by <code className="text-brand-300 font-mono">pricing.service.ts</code> for every student quote.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-surface-dark border border-surface-border text-xs font-mono text-slate-300">
              Platform Fee: {rateCard.platformFee}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Paper Sheet Media Cost */}
            <div className="rounded-2xl border border-surface-border bg-surface-dark p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-400" />
                Physical Paper Sheet Cost (Base Media)
              </h3>
              <div className="divide-y divide-surface-border text-xs">
                {rateCard.paperSheet.map((item) => (
                  <div key={item.size} className="flex justify-between py-2.5">
                    <span className="font-semibold text-white">{item.size} Bond Paper</span>
                    <span className="font-mono text-brand-300">{item.inr}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Toner Impression Cost */}
            <div className="rounded-2xl border border-surface-border bg-surface-dark p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Palette className="h-4 w-4 text-brand-400" />
                Toner / Drum Impression Fee (Per Printed Side)
              </h3>
              <div className="divide-y divide-surface-border text-xs">
                {rateCard.toner.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-2">
                    <span className="text-slate-300">
                      {item.size} • {item.mode}
                    </span>
                    <span className="font-mono text-brand-300">{item.inr}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Printer Registry */}
        <div className="rounded-3xl border border-surface-border bg-surface-card p-6 shadow-xl space-y-6">
          <div className="border-b border-surface-border pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Printer className="h-5 w-5 text-brand-400" />
              Registered Campus Hardware & Printer Registry
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Production print engines connected via USB, IPP, and Network RAW ports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {printers.map((printer) => (
              <div
                key={printer.id}
                className="rounded-2xl border border-surface-border bg-surface-dark p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{printer.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{printer.model}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      printer.status === 'ONLINE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {printer.status}
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <p>Endpoint: {printer.connection}</p>
                  <p>Location: {printer.center}</p>
                  <p className="text-slate-300 font-sans mt-2 pt-2 border-t border-surface-border">
                    Capabilities: {printer.capabilities}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Specs */}
        <div className="rounded-2xl border border-surface-border bg-surface-dark p-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-brand-400" />
            <span>Fastify 4.x + BullMQ Redis Gateway Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-brand-400" />
            <span>PostgreSQL 16 with Prisma ORM</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-400" />
            <span>Android PrintManager Companion Client</span>
          </div>
        </div>
      </main>
    </div>
  );
}
