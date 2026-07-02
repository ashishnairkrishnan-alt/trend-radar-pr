import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import type { NormalisedTrend } from '@/lib/apify'

export const maxDuration = 60

const LATER_URL = 'https://later.com/blog/instagram-reels-trends/'

// ─── Later.com scraper ────────────────────────────────────────────────────────
// Page structure (confirmed from debug):
//   <h3><b>Trend: </b><b>Name</b> <b>— Date</b></h3>
//   <p data-rich="true"><b>Trend Recap: </b>description</p>
//   <p data-rich="true"><b>Audio: </b><a href="instagram.com/reels/audio/ID/">...</a></p>
//   <iframe src="https://www.instagram.com/p/POST_ID/embed/" ...></iframe>

const MAX_TRENDS = 8        // cap to avoid Vercel 60s timeout (8 × ~5s Claude = ~40s)
const MAX_AGE_DAYS = 35    // only seed trends from the last 5 weeks (current + last month)

interface DiscoveredTrend {
  trend_name: string
  audio_id: string
  emotional_hook: string
  source_url: string // direct reel post URL from embedded iframe
  dated_at: Date | null
}

async function scrapeLatertrendList(): Promise<DiscoveredTrend[]> {
  const res = await fetch(LATER_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Later.com fetch failed: ${res.status}`)
  const html = await res.text()

  const trends: DiscoveredTrend[] = []
  const seenAudioIds = new Set<string>()

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

    // Skip trends with no parseable date, or older than MAX_AGE_DAYS
    if (!dated_at || isNaN(dated_at.getTime())) continue
    const ageDays = (Date.now() - dated_at.getTime()) / 86400000
    if (ageDays > MAX_AGE_DAYS) continue

    // Strip "Trend: " prefix and " — Month DD, YYYY" suffix
    const trend_name = decodeHtmlEntities(
      rawHeading
        .replace(/^trend\s*:\s*/i, '')
        .replace(/\s*[—–-]\s*\w+\.?\s+\d+,?\s*\d{4}\s*$/, '')
        .trim()
    )
    if (!trend_name || trend_name.length < 3) continue

    // ── Audio ID ──
    const audioMatch = section.match(/instagram\.com\/reels\/audio\/(\d{8,})/)
    if (!audioMatch) continue
    const audio_id = audioMatch[1]
    if (seenAudioIds.has(audio_id)) continue
    seenAudioIds.add(audio_id)

    // ── Source URL: prefer embedded post iframe, fall back to audio page ──
    const iframeMatch = section.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)\/embed/)
    const source_url = iframeMatch
      ? `https://www.instagram.com/p/${iframeMatch[1]}/`
      : `https://www.instagram.com/reels/audio/${audio_id}/`

    // ── Emotional hook: text after <b>Trend Recap:</b> ──
    const recapMatch = section.match(/<b>\s*Trend Recap\s*:?\s*<\/b>([\s\S]{20,500}?)<\/p>/i)
    const rawHook = recapMatch
      ? recapMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
      : `Trending Instagram Reels format — ${trend_name}`
    const emotional_hook = decodeHtmlEntities(rawHook).slice(0, 200).trim()

    trends.push({ trend_name, audio_id, emotional_hook, source_url, dated_at })
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    const discovered = await scrapeLatertrendList().catch(e => ({ error: String(e) }))
    return NextResponse.json({
      h3count: (html.match(/<h3/gi) || []).length,
      audioCount: (html.match(/reels\/audio/gi) || []).length,
      iframeCount: (html.match(/instagram\.com\/p\/[A-Za-z0-9_-]+\/embed/gi) || []).length,
      firstTrendSectionPreview: firstTrend?.slice(0, 600) ?? 'none',
      discovered,
    })
  }

  // ?reset=1 — wipe all curated seeds then return immediately (call without reset to seed)
  if (request.nextUrl.searchParams.get('reset') === '1') {
    const { count: c1 } = await supabase.from('scored_trends')
      .delete({ count: 'exact' })
      .eq('platform', 'instagram')
      .eq('spike_pct', 85)
    const { count: c2 } = await supabase.from('scored_trends')
      .delete({ count: 'exact' })
      .like('source_url', '%instagram.com/reels/audio/%')
    return NextResponse.json({ success: true, reset: true, deleted: (c1 ?? 0) + (c2 ?? 0) })
  }

  // Step 1 — scrape Later.com
  let discovered: DiscoveredTrend[]
  try {
    discovered = await scrapeLatertrendList()
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Later.com scrape failed: ${String(err)}` },
      { status: 500 }
    )
  }

  if (discovered.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No trends parsed from Later.com — page structure may have changed' },
      { status: 500 }
    )
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
      message: 'All trends already seeded for this week',
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
        platform: 'instagram',
        trend_name: trend.trend_name,
        trend_type: 'audio',
        emotional_hook: trend.emotional_hook,
        engagement_volume: 100000,
        spike_pct: 85,
        source_url: trend.source_url,
        raw_data: { audio_id: trend.audio_id },
      }

      const scores = await scoreNormalisedTrend(normTrend)

      const { error } = await supabase.from('scored_trends').upsert(
        {
          trend_name: cleanText(trend.trend_name, 100),
          platform: 'instagram',
          trend_type: 'audio',
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

  const postLinks = fresh.filter(t => t.source_url.includes('/p/')).length
  return NextResponse.json({
    success: true,
    discovered: discovered.length,
    postLinks,
    audioFallbacks: fresh.length - postLinks,
    fresh: fresh.length,
    scored,
    errors,
  })
}
