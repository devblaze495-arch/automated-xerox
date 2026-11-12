'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Printer, ShoppingBag, ShieldCheck, Activity, Laptop, Settings, Sparkles, Lock, Crown, BarChart3 } from 'lucide-react';
import { getConnectedAgents, getSubscriptionStatus } from '@/lib/api';
import { SubscriptionStatusInfo } from '@/lib/types';

interface NavbarProps {
  cartCount?: number;
  onOpenCart?: () => void;
}

export function Navbar({ cartCount = 0, onOpenCart }: NavbarProps) {
  const pathname = usePathname();
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [onlineTerminals, setOnlineTerminals] = useState<number>(0);
  const [subStatus, setSubStatus] = useState<SubscriptionStatusInfo | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        const data = await getConnectedAgents();
        if (isMounted) {
          setIsBackendOnline(true);
          setOnlineTerminals(data.totalConnected || 0);
        }
      } catch {
        if (isMounted) {
          setIsBackendOnline(false);
          setOnlineTerminals(0);
        }
      }

      try {
        const sub = await getSubscriptionStatus();
        if (isMounted) {
          setSubStatus(sub);
        }
      } catch {}
    }

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { label: 'Student Portal', href: '/student', icon: ShoppingBag },
    { label: 'Operator Workbench', href: '/operator', icon: Laptop },
    { label: 'Analytics & Ledger', href: '/operator/analytics', icon: BarChart3 },
    { label: 'Admin Settings', href: '/admin', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-surface-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/student" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 group-hover:scale-105 transition-transform">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-lg text-white tracking-tight">
              CampusPrint
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/40">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-none">Automated Campus Xerox Gateway</p>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-dark border border-surface-border p-1 rounded-xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/student' && pathname === '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-surface-elevated'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Gateway Status & Cart */}
        <div className="flex items-center gap-3">
          {/* Subscription Status Pill */}
          {subStatus?.isSubscribed ? (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>Pro: {subStatus.daysRemaining}d left</span>
            </div>
          ) : (
            <Link
              href="/operator"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
            >
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span>Shop Terminal License</span>
            </Link>
          )}

          {/* Live Gateway Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-dark border border-surface-border text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                isBackendOnline
                  ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-300">
              Gateway: <strong className="text-white">{isBackendOnline ? 'Online' : 'Offline'}</strong>
            </span>
            {onlineTerminals > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                {onlineTerminals} bridge active
              </span>
            )}
          </div>

          {/* Cart Drawer Trigger */}
          {onOpenCart && (
            <button
              onClick={onOpenCart}
              className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors shadow-sm"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Review Order</span>
              {cartCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-700 text-xs font-bold font-mono">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

