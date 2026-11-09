import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusPrint - Smart Campus Xerox & Printing Platform',
  description: 'Instant student printing orders with exact sheet-level pricing and automated Android terminal dispatch.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-slate-100 selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}

