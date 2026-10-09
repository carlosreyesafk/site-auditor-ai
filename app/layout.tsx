import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'site-auditor-ai 🌐 — Instant website audit: SEO, performance, accessibility',
  description: 'Paste any URL and get a professional website audit in seconds: SEO, accessibility, performance and best practices with actionable recommendations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
