import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import type { NormalisedTrend } from '@/lib/apify'

export const maxDuration = 60

const LATER_URL = 'https://later.com/blog/tiktok-trends/'

// ─── Later.com TikTok scraper ─────────────────────────────────────────────────
// Expected page structure (same blog engine as IG page):
//   <h3><b>Trend: </b><b>Name</b> <b>— Date</b></h3>
//   <p data-rich="true"><b>Trend Recap: </b>description</p>
//   <blockquote class="tiktok-embed" cite="https://www.tiktok.com/@user/video/ID">
//   OR <iframe src="https://www.tiktok.com/embed/v2/ID">
//   OR <a href="https://www.tiktok.com/@user/video/ID">

const MAX_TRENDS = 8   // cap to avoid Vercel 60s timeout (8 × ~5s Claude = ~40s)

interface DiscoveredTrend {
  trend_name: string
  emotional_hook: string
  source_url: string
  dated_at: Date | null
}

async function scrapeLaterTikTokList(): Promise<DiscoveredTrend[]> {
  const res = await fetch(LATER_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Later.com TikTok fetch failed: ${res.status}`)
  const html = await res.text()

  const trends: DiscoveredTrend[] = []
  const seenUrls = new Set<string>()

  // Only include current month and previous month (e.g. June + July, never May)
  const now = new Date()
  const firstDayOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))

  // Split on <h3> boundaries — each section is one trend
  const sections = html.split(/<h3[^>]*>/i).slice(1)

  for (const section of sections) {
    // ── Heading text (may contain inner <b> tags) ──
    const headingMatch = section.match(/^([\s\S]*?)<\/h3>/i)
    if (!headingMatch) continue
    const rawHeading = headingMatch[1].replace(/<[^>]+>/g, '').trim()

    // Only process sections that start with "Trend:"
    if (!/^trend\s*:/i.test(rawHeading)) continue

    // Parse date from " — Month DD, YYYY" suffix before stripping it
    const dateMatch = rawHeading.match(/[—–-]\s*(\w+ \d+,?\s*\d{4})\s*$/)
    const dated_at = dateMatch ? new Date(dateMatch[1]) : null

    // Skip trends with no parseable date, or from before last month
    if (!dated_at || isNaN(dated_at.getTime())) continue
    if (dated_at < firstDayOfPrevMonth) continue

    // Strip "Trend: " prefix and " — Month DD, YYYY" suffix
    const trend_name = decodeHtmlEntities(
      rawHeading
        .replace(/^trend\s*:\s*/i, '')
        .replace(/\s*[—–-]\s*\w+\.?\s+\d+,?\s*\d{4}\s*$/, '')
        .trim()
    )
    if (!trend_name || trend_name.length < 3) continue

    // ── Source URL: try multiple TikTok embed patterns ──
    // 1. TikTok blockquote embed: <blockquote cite="https://www.tiktok.com/@user/video/ID">
    const blockquoteMatch = section.match(/cite=["']https?:\/\/(?:www\.)?tiktok\.com\/@([^/]+)\/video\/(\d+)["']/i)
    // 2. Direct TikTok link in <a href>
    const directMatch = section.match(/href=["']https?:\/\/(?:www\.)?tiktok\.com\/@([^/]+)\/video\/(\d+)["']/i)
    // 3. TikTok iframe: <iframe src="https://www.tiktok.com/embed/v2/ID">
    const iframeMatch = section.match(/tiktok\.com\/embed\/v2\/(\d+)/i)
    // 4. TikTok music/audio link from "Audio:" section (e.g. tiktok.com/music/NAME-ID)
    const musicMatch = section.match(/href=["'](https?:\/\/(?:www\.)?tiktok\.com\/music\/[^"'?\s]+)/i)

    let source_url: string
    if (blockquoteMatch) {
      source_url = `https://www.tiktok.com/@${blockquoteMatch[1]}/video/${blockquoteMatch[2]}`
    } else if (directMatch) {
      source_url = `https://www.tiktok.com/@${directMatch[1]}/video/${directMatch[2]}`
    } else if (iframeMatch) {
      source_url = `https://www.tiktok.com/video/${iframeMatch[1]}`
    } else if (musicMatch) {
      source_url = musicMatch[1]
    } else {
      // Last resort: TikTok search for this trend
      source_url = `https://www.tiktok.com/search?q=${encodeURIComponent(trend_name)}`
    }

    if (seenUrls.has(source_url)) continue
    seenUrls.add(source_url)

    // ── Emotional hook: text after <b>Trend Recap:</b> ──
    const recapMatch = section.match(/<b>\s*Trend Recap\s*:?\s*<\/b>([\s\S]{20,500}?)<\/p>/i)
    const rawHook = recapMatch
      ? recapMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
      : `Trending TikTok format — ${trend_name}`
    const emotional_hook = decodeHtmlEntities(rawHook).slice(0, 200).trim()

    trends.push({ trend_name, emotional_hook, source_url, dated_at })
    if (trends.length >= MAX_TRENDS) break
  }

  return trends
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, '')
}

function cleanText(s: string, max = 200): string {
  return (s || '').replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, max).trim()
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const now = new Date()
  const week_number = getWeekNumber(now)
  const year = now.getFullYear()

  // ?debug=1 — inspect what the parser sees without writing anything
  if (request.nextUrl.searchParams.get('debug') === '1') {
    const res = await fetch(LATER_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36' },
      signal: AbortSignal.timeout(20000),
    })
    const html = await res.text()
    const sections = html.split(/<h3[^>]*>/i)
    const firstTrend = sections.find(s => /trend\s*:/i.test(s.slice(0, 300)))
    const discovered = await scrapeLaterTikTokList().catch(e => ({ error: String(e) }))
    return NextResponse.json({
      status: res.status,
      htmlLength: html.length,
      h3count: (html.match(/<h3/gi) || []).length,
      blockquoteCount: (html.match(/tiktok-embed/gi) || []).length,
      iframeCount: (html.match(/tiktok\.com\/embed\/v2\//gi) || []).length,
      directLinkCount: (html.match(/tiktok\.com\/@[^/]+\/video\//gi) || []).length,
      musicLinkCount: (html.match(/tiktok\.com\/music\//gi) || []).length,
      firstTrendSectionPreview: firstTrend?.slice(0, 600) ?? 'none',
      discovered,
    })
  }

  // ?reset=1 — wipe all TikTok curated seeds then return immediately
  if (request.nextUrl.searchParams.get('reset') === '1') {
    const { count } = await supabase.from('scored_trends')
      .delete({ count: 'exact' })
      .eq('platform', 'tiktok')
      .eq('spike_pct', 85)
    return NextResponse.json({ success: true, reset: true, deleted: count ?? 0 })
  }

  // Step 1 — scrape Later.com TikTok trends
  let discovered: DiscoveredTrend[]
  try {
    discovered = await scrapeLaterTikTokList()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Later.com TikTok scrape failed: ${String(err)}` },
      { status: 500 }
    )
  }

  if (discovered.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No TikTok trends parsed from Later.com — page structure may have changed' },
      { status: 500 }
    )
  }

  // ?refresh=1 — safe weekly reset. We only reach here AFTER a successful scrape
  // returned fresh trends, so clearing old seeds now can never leave the DB empty.
  if (request.nextUrl.searchParams.get('refresh') === '1') {
    await supabase.from('scored_trends').delete()
      .eq('platform', 'tiktok').eq('spike_pct', 85)
  }

  // Step 2 — dedup against existing source_urls
  const urls = discovered.map(t => t.source_url)
  const { data: existing } = await supabase
    .from('scored_trends').select('source_url').in('source_url', urls)
  const existingUrls = new Set((existing || []).map(r => r.source_url))
  const fresh = discovered.filter(t => !existingUrls.has(t.source_url))

  if (fresh.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'All TikTok trends already seeded for this week',
      discovered: discovered.length,
      scored: 0,
    })
  }

  // Step 3 — score with Claude and upsert
  let scored = 0
  const errors: string[] = []

  for (const trend of fresh) {
    try {
      const normTrend: NormalisedTrend = {
        platform: 'tiktok',
        trend_name: trend.trend_name,
        trend_type: 'format',
        emotional_hook: trend.emotional_hook,
        engagement_volume: 100000,
        spike_pct: 85,
        source_url: trend.source_url,
        raw_data: {},
      }

      const scores = await scoreNormalisedTrend(normTrend)

      const { error } = await supabase.from('scored_trends').upsert(
        {
          trend_name: cleanText(trend.trend_name, 100),
          platform: 'tiktok',
          trend_type: 'format',
          emotional_hook: cleanText(trend.emotional_hook, 200),
          spike_pct: 85,
          source_url: trend.source_url,
          week_number,
          year,
          engagement_score: 100000,
          ...scores,
        },
        { onConflict: 'source_url', ignoreDuplicates: true }
      )

      if (error) errors.push(`${trend.trend_name}: ${error.message}`)
      else scored++
    } catch (err) {
      errors.push(`${trend.trend_name}: ${String(err)}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  const videoLinks = fresh.filter(t => t.source_url.includes('/video/')).length
  return NextResponse.json({
    success: true,
    discovered: discovered.length,
    videoLinks,
    searchFallbacks: fresh.length - videoLinks,
    fresh: fresh.length,
    scored,
    errors,
  })
}
