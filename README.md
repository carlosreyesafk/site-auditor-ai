# site-auditor-ai 🌐

**Professional website audits in seconds.** Paste any URL → get instant scores for SEO, accessibility, performance and best practices, with prioritized, actionable fixes.

🌐 **Live demo:** https://site-auditor-7r3a4uln6-carlosreyesafks-projects.vercel.app

## What it does

- 🔍 **Real audits, not mockups** — fetches the live page server-side (no CORS issues) and analyzes the actual HTML
- 📊 **4 category scores 0–100** with gauge visualization: SEO, Accessibility, Performance, Best Practices
- 🎯 **Prioritized recommendations** — what to fix first, with impact level (high/medium/low) and plain-English explanations
- ✅ **18+ individual checks**: title & meta description, Open Graph tags, H1 uniqueness, heading hierarchy, images without alt, unlabeled buttons/inputs, HTTPS, mobile viewport, page weight, server response time…
- 📜 **Audit history** in localStorage — re-run and compare scores over time
- ⚡ **Server-side proxy** via Next.js API route (avoids CORS, measures real load time)

## How the audit works

`POST /api/audit` fetches the URL with a 15s timeout, parses HTML with Cheerio, then runs 18 checks across 4 categories. Each failed check generates a recommendation ranked by impact. Scores are the pass-rate per category.

## Run it locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Stack

`Next.js 14` (App Router + API Routes) · `TypeScript` · `Tailwind CSS` · `Cheerio`

## Project structure

```
app/                  → page (UI), layout, globals
app/api/audit/route.ts → the audit engine (fetch + analyze + score)
components/           → ScoreGauge
```

---

Built by [Carlos Reyes](https://github.com/carlosreyesafk) — Software Developer · React · TypeScript · Supabase
