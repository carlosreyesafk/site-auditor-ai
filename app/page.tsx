'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ScoreGauge from '@/components/ScoreGauge';
import type { AuditResult } from '@/app/api/audit/route';

interface HistoryEntry {
  url: string;
  timestamp: string;
  overall: number;
  scores: AuditResult['scores'];
}

const IMPACT_STYLE = {
  high: 'bg-red-500/10 text-red-300 border-red-500/30',
  medium: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  low: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
} as const;

const CATEGORIES = [
  { key: 'seo', label: 'SEO' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'performance', label: 'Performance' },
  { key: 'bestPractices', label: 'Best Practices' },
] as const;

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showChecks, setShowChecks] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Ref mirror of url so runAudit always reads the latest typed value,
  // even if the state closure is stale on the first submit.
  const urlRef = useRef('');
  const setUrlSync = useCallback((v: string) => {
    urlRef.current = v;
    setUrl(v);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('site-auditor-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const saveHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.url !== entry.url)].slice(0, 20);
      try { localStorage.setItem('site-auditor-history', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const runAudit = useCallback(async (target?: string) => {
    const u = (target ?? urlRef.current).trim();
    if (!u) { setError('Enter a URL to audit.'); return; }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Audit failed. Try again.');
        return;
      }
      setResult(data as AuditResult);
      saveHistory({ url: data.finalUrl || u, timestamp: data.timestamp, overall: data.overall, scores: data.scores });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }, [url, saveHistory]);

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem('site-auditor-history'); } catch { /* ignore */ }
  };

  const scoreColor = (s: number) => s >= 90 ? 'text-emerald-400' : s >= 70 ? 'text-lime-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 w-[600px] h-[600px] rounded-full bg-violet-500/[0.08] blur-[120px]" />
        <div className="absolute top-1/2 -left-20 w-[500px] h-[500px] rounded-full bg-blue-500/[0.06] blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* header */}
        <header className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-5xl">🌐</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            site<span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">-auditor-ai</span>
          </h1>
          <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">
            Paste any URL. Get a professional audit in seconds — SEO, accessibility, performance and best practices, with prioritized fixes.
          </p>
        </header>

        {/* input */}
        <form
          onSubmit={(e) => { e.preventDefault(); runAudit(); }}
          className="max-w-3xl mx-auto mb-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={url}
              onChange={(e) => setUrlSync(e.target.value)}
              placeholder="https://example.com"
              spellCheck={false}
              className="flex-1 px-5 py-4 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 font-mono text-sm transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-wait transition-all shadow-[0_0_30px_rgba(139,92,246,0.3)] whitespace-nowrap"
            >
              {loading ? 'Auditing…' : '🔍 Audit site'}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5">{error}</p>
          )}
        </form>

        {/* quick examples */}
        {!result && !loading && (
          <div className="text-center mb-10">
            <span className="text-xs text-zinc-600 mr-2">Try:</span>
            {['https://example.com', 'https://github.com', 'https://vercel.com'].map((u) => (
              <button
                key={u}
                onClick={() => { setUrlSync(u); runAudit(u); }}
                className="text-xs font-mono text-zinc-500 hover:text-violet-300 underline underline-offset-2 decoration-zinc-700 mx-1.5"
              >
                {u.replace('https://', '')}
              </button>
            ))}
          </div>
        )}

        {/* loading */}
        {loading && (
          <div className="max-w-3xl mx-auto text-center py-16">
            <div className="inline-block w-12 h-12 border-4 border-violet-500/20 border-t-violet-400 rounded-full animate-spin mb-4" />
            <p className="text-zinc-400">Fetching page, analyzing SEO, accessibility & performance…</p>
          </div>
        )}

        {/* results */}
        {result && !loading && (
          <div className="max-w-5xl mx-auto">
            {/* summary card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Overall score</p>
                  <p className={`text-6xl font-extrabold tabular-nums ${scoreColor(result.overall)}`}>{result.overall}</p>
                  <p className="text-xs text-zinc-500 mt-1">/ 100</p>
                </div>
                <div className="flex-1">
                  <p className="font-mono text-sm text-zinc-300 break-all">{result.finalUrl}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-zinc-500">
                    <span>⚡ {result.loadTimeMs}ms load</span>
                    <span>📦 {result.pageSizeKb} KB HTML</span>
                    <span>🖼️ {result.meta.imagesTotal} images</span>
                    <span>📑 {result.meta.headings.length} headings</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex justify-center">
                    <ScoreGauge score={result.scores[c.key]} label={c.label} />
                  </div>
                ))}
              </div>
            </div>

            {/* recommendations */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4">
                🎯 Prioritized fixes <span className="text-sm font-normal text-zinc-500">({result.recommendations.length})</span>
              </h2>
              {result.recommendations.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-8 text-center">
                  <p className="text-4xl mb-2">✨</p>
                  <p className="font-semibold text-emerald-200">Flawless!</p>
                  <p className="text-sm text-zinc-500 mt-1">No issues found. This site is in great shape.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {result.recommendations.map((r, i) => (
                    <div key={r.id} className={`rounded-xl border p-4 ${IMPACT_STYLE[r.impact]}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-bold bg-white/10 rounded-md px-2 py-1 shrink-0">#{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-zinc-100">{r.title}</p>
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border border-current opacity-80">
                              {r.impact} impact
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">{r.category}</span>
                          </div>
                          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">{r.detail}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* checks detail */}
            <div className="mb-6">
              <button
                onClick={() => setShowChecks(!showChecks)}
                className="text-sm font-semibold text-zinc-300 hover:text-white flex items-center gap-2"
              >
                <span className={`transition-transform ${showChecks ? 'rotate-180' : ''}`}>▾</span>
                All {result.checks.length} checks {showChecks ? '▲' : ''}
              </button>
              {showChecks && (
                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  {result.checks.map((c, i) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-3.5 py-2.5 flex items-start gap-2.5">
                      <span className="text-base shrink-0">{c.passed ? '✅' : '❌'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200">{c.label}</p>
                        <p className="text-xs text-zinc-500 truncate">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* history */}
        {history.length > 0 && (
          <div className="max-w-5xl mx-auto mt-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">� history</h2>
              <button onClick={clearHistory} className="text-xs text-zinc-500 hover:text-red-300">Clear</button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {history.map((h) => (
                <button
                  key={h.url + h.timestamp}
                  onClick={() => { setUrlSync(h.url); runAudit(h.url); }}
                  className="text-left rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-violet-400/40 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-2xl font-extrabold tabular-nums ${scoreColor(h.overall)}`}>{h.overall}</span>
                    <span className="text-[10px] text-zinc-600">{new Date(h.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-mono text-zinc-400 truncate">{h.url.replace(/^https?:\/\//, '')}</p>
                  <div className="flex gap-2 mt-2 text-[10px] text-zinc-500">
                    <span>SEO {h.scores.seo}</span><span>A11y {h.scores.accessibility}</span>
                    <span>Perf {h.scores.performance}</span><span>BP {h.scores.bestPractices}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-14 pt-6 border-t border-white/5 text-center text-xs text-zinc-600">
          site-auditor-ai · audits run server-side, results stay in your browser · built with Next.js + TypeScript
        </footer>
      </div>
    </div>
  );
}
