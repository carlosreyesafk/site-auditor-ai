import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export interface Recommendation {
  id: string;
  category: 'SEO' | 'Accessibility' | 'Performance' | 'Best Practices';
  impact: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

export interface AuditResult {
  url: string;
  finalUrl: string;
  timestamp: string;
  loadTimeMs: number;
  pageSizeKb: number;
  scores: {
    seo: number;
    accessibility: number;
    performance: number;
    bestPractices: number;
  };
  overall: number;
  checks: { label: string; passed: boolean; detail: string; category: string }[];
  recommendations: Recommendation[];
  meta: {
    title: string | null;
    titleLength: number;
    description: string | null;
    descriptionLength: number;
    ogTags: string[];
    missingOgTags: string[];
    h1Count: number;
    headings: { tag: string; text: string }[];
    imagesTotal: number;
    imagesWithoutAlt: number;
    linksWithoutText: number;
    buttonsWithoutLabel: number;
    hasViewport: boolean;
    hasLang: boolean;
    lang: string | null;
    hasCharset: boolean;
    isHttps: boolean;
  };
}

function isValidUrl(s: string): string | null {
  let u = s.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = typeof body?.url === 'string' ? body.url : '';
    const url = isValidUrl(rawUrl);
    if (!url) {
      return NextResponse.json({ error: 'Please enter a valid URL (e.g. https://example.com)' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const start = Date.now();

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SiteAuditor/1.0; +https://site-auditor-ai.vercel.app)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
    } catch (e: unknown) {
      clearTimeout(timeout);
      const msg = e instanceof Error && e.name === 'AbortError'
        ? 'The site took too long to respond (timeout after 15s).'
        : 'Could not reach that URL. Check the address and try again.';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    clearTimeout(timeout);

    const loadTimeMs = Date.now() - start;
    if (!res.ok) {
      return NextResponse.json({ error: `The site returned HTTP ${res.status}. Only public pages can be audited.` }, { status: 502 });
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      return NextResponse.json({ error: 'That URL did not return HTML content.' }, { status: 400 });
    }

    const html = await res.text();
    const pageSizeKb = Math.round((new TextEncoder().encode(html).length / 1024) * 10) / 10;
    const $ = cheerio.load(html);

    const checks: AuditResult['checks'] = [];
    const recommendations: Recommendation[] = [];
    const push = (label: string, passed: boolean, detail: string, category: string) =>
      checks.push({ label, passed, detail, category });
    const rec = (id: string, category: Recommendation['category'], impact: Recommendation['impact'], title: string, detail: string) =>
      recommendations.push({ id, category, impact, title, detail });

    // ---------------- SEO ----------------
    const title = $('title').first().text().trim() || null;
    const titleLength = title?.length ?? 0;
    if (!title) {
      push('Page has a <title>', false, 'Missing entirely', 'SEO');
      rec('seo-title', 'SEO', 'high', 'Add a <title> tag', 'Every page needs a unique, descriptive title. It is the #1 on-page ranking factor and what shows in Google results.');
    } else if (titleLength < 30) {
      push('Title length is optimal (30–60 chars)', false, `${titleLength} chars — too short`, 'SEO');
      rec('seo-title-len', 'SEO', 'high', `Expand your title (${titleLength} chars)`, 'Aim for 30–60 characters with your main keyword near the front. Short titles get rewritten by Google.');
    } else if (titleLength > 60) {
      push('Title length is optimal (30–60 chars)', false, `${titleLength} chars — will be truncated`, 'SEO');
      rec('seo-title-len', 'SEO', 'medium', `Shorten your title (${titleLength} chars)`, 'Google truncates titles over ~60 characters. Put the important words first.');
    } else {
      push('Title length is optimal (30–60 chars)', true, `${titleLength} chars`, 'SEO');
    }

    const description = $('meta[name="description"]').attr('content')?.trim() || null;
    const descriptionLength = description?.length ?? 0;
    if (!description) {
      push('Meta description present', false, 'Missing', 'SEO');
      rec('seo-desc', 'SEO', 'high', 'Add a meta description', 'Google often uses it as your search snippet. 50–160 chars that sell the click.');
    } else if (descriptionLength < 50 || descriptionLength > 160) {
      push('Meta description length (50–160)', false, `${descriptionLength} chars`, 'SEO');
      rec('seo-desc-len', 'SEO', 'medium', 'Tune meta description length', 'Keep it between 50–160 characters so it displays fully in search results.');
    } else {
      push('Meta description present & well-sized', true, `${descriptionLength} chars`, 'SEO');
    }

    const ogWanted = ['og:title', 'og:description', 'og:image'];
    const ogTags = ogWanted.filter((p) => $(`meta[property="${p}"]`).attr('content'));
    const missingOgTags = ogWanted.filter((p) => !ogTags.includes(p));
    if (missingOgTags.length > 0) {
      push('Open Graph tags for social sharing', false, `Missing: ${missingOgTags.join(', ')}`, 'SEO');
      rec('seo-og', 'SEO', 'medium', 'Add Open Graph tags', 'Without og:title/og:description/og:image, link shares on X/LinkedIn/WhatsApp look broken and get fewer clicks.');
    } else {
      push('Open Graph tags for social sharing', true, 'og:title, og:description, og:image present', 'SEO');
    }

    const h1s = $('h1');
    const h1Count = h1s.length;
    const headings: { tag: string; text: string }[] = [];
    $('h1, h2, h3').each((_, el) => {
      headings.push({ tag: el.tagName.toLowerCase(), text: $(el).text().trim().slice(0, 80) });
    });
    if (h1Count === 0) {
      push('Exactly one H1', false, 'No H1 found', 'SEO');
      rec('seo-h1', 'SEO', 'high', 'Add one H1 per page', 'The H1 tells search engines what the page is about. Use exactly one, containing the primary keyword.');
    } else if (h1Count > 1) {
      push('Exactly one H1', false, `${h1Count} H1 tags found`, 'SEO');
      rec('seo-h1', 'SEO', 'medium', `Reduce to a single H1 (found ${h1Count})`, 'Multiple H1s dilute topical focus. Demote extras to H2.');
    } else {
      push('Exactly one H1', true, `"${h1s.first().text().trim().slice(0, 60)}"`, 'SEO');
    }
    // heading hierarchy: check for skipped levels
    const levels = headings.map((h) => parseInt(h.tag[1]));
    let skipped = false;
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1) { skipped = true; break; }
    }
    if (skipped && headings.length > 1) {
      push('Heading hierarchy has no skipped levels', false, 'e.g. H1 → H3 jump detected', 'SEO');
      rec('seo-headings', 'SEO', 'low', 'Fix heading hierarchy', 'Do not skip levels (H1 → H3). Screen readers and crawlers use headings as the page outline.');
    } else {
      push('Heading hierarchy is clean', true, `${headings.length} headings found`, 'SEO');
    }

    const canonical = $('link[rel="canonical"]').attr('href');
    if (!canonical) {
      rec('seo-canonical', 'SEO', 'low', 'Add a canonical URL', 'Prevents duplicate-content issues when the same page is reachable via multiple URLs.');
    }
    push('Canonical URL defined', !!canonical, canonical || 'Missing', 'SEO');

    // ---------------- Accessibility ----------------
    const imgs = $('img');
    const imagesTotal = imgs.length;
    let imagesWithoutAlt = 0;
    imgs.each((_, el) => { if (!$(el).attr('alt')) imagesWithoutAlt++; });
    if (imagesTotal > 0 && imagesWithoutAlt > 0) {
      const pct = Math.round((imagesWithoutAlt / imagesTotal) * 100);
      push('All images have alt text', false, `${imagesWithoutAlt}/${imagesTotal} missing alt (${pct}%)`, 'Accessibility');
      rec('a11y-alt', 'Accessibility', imagesWithoutAlt / imagesTotal > 0.3 ? 'high' : 'medium', `Add alt text to ${imagesWithoutAlt} images`, 'Screen readers announce images via alt text. Decorative images should have empty alt="". This is also an SEO signal.');
    } else if (imagesTotal > 0) {
      push('All images have alt text', true, `${imagesTotal} images, all with alt`, 'Accessibility');
    } else {
      push('All images have alt text', true, 'No images on page', 'Accessibility');
    }

    const lang = $('html').attr('lang') || null;
    const hasLang = !!lang;
    push('Page declares a language', hasLang, lang ? `lang="${lang}"` : 'Missing lang attribute', 'Accessibility');
    if (!hasLang) rec('a11y-lang', 'Accessibility', 'medium', 'Add lang attribute to <html>', 'Screen readers need it to pick the right pronunciation. Also helps SEO geo-targeting.');

    let buttonsWithoutLabel = 0;
    $('button').each((_, el) => {
      const $el = $(el);
      if (!$el.text().trim() && !$el.attr('aria-label') && !$el.attr('title')) buttonsWithoutLabel++;
    });
    if (buttonsWithoutLabel > 0) {
      push('Buttons have accessible labels', false, `${buttonsWithoutLabel} icon-only buttons unlabeled`, 'Accessibility');
      rec('a11y-buttons', 'Accessibility', 'medium', 'Label icon-only buttons', 'Add aria-label to buttons with no visible text so assistive tech can announce them.');
    } else {
      push('Buttons have accessible labels', true, 'All buttons labeled', 'Accessibility');
    }

    let linksWithoutText = 0;
    $('a').each((_, el) => {
      const $el = $(el);
      if (!$el.text().trim() && !$el.attr('aria-label') && $el.find('img[alt]').length === 0) linksWithoutText++;
    });
    if (linksWithoutText > 0) {
      push('Links have discernible text', false, `${linksWithoutText} empty links`, 'Accessibility');
      rec('a11y-links', 'Accessibility', 'low', 'Give every link text or aria-label', 'Empty links are invisible to screen readers and keyboard users.');
    } else {
      push('Links have discernible text', true, 'All links have text', 'Accessibility');
    }

    let inputsWithoutLabel = 0;
    $('input').each((_, el) => {
      const $el = $(el);
      const type = ($el.attr('type') || 'text').toLowerCase();
      if (['hidden', 'submit', 'button'].includes(type)) return;
      const id = $el.attr('id');
      if (!$el.attr('aria-label') && !$el.attr('placeholder') && !(id && $(`label[for="${id}"]`).length)) inputsWithoutLabel++;
    });
    if (inputsWithoutLabel > 0) {
      rec('a11y-inputs', 'Accessibility', 'medium', `Label ${inputsWithoutLabel} form inputs`, 'Associate each input with a <label>, aria-label or placeholder.');
    }
    push('Form inputs are labeled', inputsWithoutLabel === 0, inputsWithoutLabel === 0 ? 'All labeled' : `${inputsWithoutLabel} unlabeled`, 'Accessibility');

    // ---------------- Performance ----------------
    if (pageSizeKb < 200) {
      push('HTML size is lean (<200KB)', true, `${pageSizeKb} KB`, 'Performance');
    } else if (pageSizeKb < 500) {
      push('HTML size is reasonable (<500KB)', true, `${pageSizeKb} KB`, 'Performance');
    } else {
      push('HTML size is lean', false, `${pageSizeKb} KB — heavy`, 'Performance');
      rec('perf-size', 'Performance', 'high', `Reduce page weight (${pageSizeKb} KB HTML)`, 'Heavy HTML slows first paint, especially on mobile networks. Split content, lazy-load below the fold.');
    }
    if (loadTimeMs < 800) {
      push('Server responds fast (<800ms)', true, `${loadTimeMs}ms`, 'Performance');
    } else if (loadTimeMs < 2000) {
      push('Server response is acceptable (<2s)', true, `${loadTimeMs}ms`, 'Performance');
    } else {
      push('Server responds fast', false, `${loadTimeMs}ms — slow`, 'Performance');
      rec('perf-ttfb', 'Performance', 'high', `Speed up server response (${loadTimeMs}ms)`, 'Slow TTFB delays everything. Enable caching, use a CDN, and optimize server rendering.');
    }

    const scriptCount = $('script[src]').length;
    const cssCount = $('link[rel="stylesheet"]').length;
    if (scriptCount > 10) {
      rec('perf-scripts', 'Performance', 'medium', `Reduce render-blocking scripts (${scriptCount})`, 'Each external script is a network round-trip. Defer non-critical JS and bundle where possible.');
    }
    push('External script count is sane', scriptCount <= 10, `${scriptCount} external scripts`, 'Performance');

    // ---------------- Best practices ----------------
    const finalUrl = res.url || url;
    const isHttps = finalUrl.startsWith('https://');
    push('Served over HTTPS', isHttps, isHttps ? 'Secure' : 'Not HTTPS — browsers flag as insecure', 'Best Practices');
    if (!isHttps) rec('bp-https', 'Best Practices', 'high', 'Migrate to HTTPS', 'Chrome marks HTTP pages "Not Secure", killing trust and conversions. Get a free cert via Let\'s Encrypt.');

    const hasViewport = !!$('meta[name="viewport"]').attr('content');
    push('Mobile viewport configured', hasViewport, hasViewport ? 'viewport meta present' : 'Missing viewport meta', 'Best Practices');
    if (!hasViewport) rec('bp-viewport', 'Best Practices', 'high', 'Add viewport meta tag', 'Without it, mobile browsers render the desktop layout zoomed out. Over 60% of traffic is mobile.');

    const hasCharset = /<meta[^>]+charset/i.test(html);
    push('Charset declared', hasCharset, hasCharset ? 'charset meta present' : 'Missing', 'Best Practices');

    const hasDoctype = /^\s*<!doctype html/i.test(html);
    push('Valid doctype', hasDoctype, hasDoctype ? '<!DOCTYPE html>' : 'Missing or legacy doctype', 'Best Practices');

    // ---------------- Scoring ----------------
    const scoreCat = (cat: string) => {
      const c = checks.filter((x) => x.category === cat);
      if (!c.length) return 100;
      return Math.round((c.filter((x) => x.passed).length / c.length) * 100);
    };
    const scores = {
      seo: scoreCat('SEO'),
      accessibility: scoreCat('Accessibility'),
      performance: scoreCat('Performance'),
      bestPractices: scoreCat('Best Practices'),
    };
    const overall = Math.round((scores.seo + scores.accessibility + scores.performance + scores.bestPractices) / 4);

    const impactRank = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => impactRank[a.impact] - impactRank[b.impact]);

    const result: AuditResult = {
      url: rawUrl,
      finalUrl,
      timestamp: new Date().toISOString(),
      loadTimeMs,
      pageSizeKb,
      scores,
      overall,
      checks,
      recommendations,
      meta: {
        title, titleLength, description, descriptionLength,
        ogTags, missingOgTags, h1Count, headings: headings.slice(0, 12),
        imagesTotal, imagesWithoutAlt, linksWithoutText, buttonsWithoutLabel,
        hasViewport, hasLang, lang, hasCharset, isHttps,
      },
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error('audit error', err);
    return NextResponse.json({ error: 'Audit failed unexpectedly. Try again.' }, { status: 500 });
  }
}
