import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import type { NormalisedTrend } from '@/lib/apify'

export const maxDuration = 300

const LATER_URL = 'https://later.com/blog/instagram-reels-trends/'
const APIFY_BASE = 'https://api.apify.com/v2'

// ─── Later.com scraper ────────────────────────────────────────────────────────

interface DiscoveredTrend {
  trend_name: string
  audio_id: string
  emotional_hook: string
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

  // Headings look like: <h3>Trend: The summer schedule — June 26, 2026</h3>
  const sections = html.split(/<h3[^>]*>/i).slice(1)

  for (const section of sections) {
    // Extract heading text before </h3>
    const headingMatch = section.match(/^([^<]{3,150})<\/h3>/i)
    if (!headingMatch) continue

    // Must start with "Trend:" prefix
    const rawHeading = headingMatch[1].trim()
    if (!/^trend\s*:/i.test(rawHeading)) continue

    // Strip "Trend: " prefix and " — Date" suffix → clean trend name
    const trend_name = decodeHtmlEntities(
      rawHeading
        .replace(/^trend\s*:\s*/i, '')
        .replace(/\s*[—–-]\s*\w+ \d+,? \d{4}\s*$/, '')
        .trim()
    )
    if (!trend_name || trend_name.length < 3) continue

    // Audio link — in <strong>Audio:</strong> paragraph
    const audioMatch = section.match(/instagram\.com\/reels\/audio\/(\d{8,})/)
    if (!audioMatch) continue
    const audio_id = audioMatch[1]
    if (seenAudioIds.has(audio_id)) continue
    seenAudioIds.add(audio_id)

    // Emotional hook — text after <strong>Trend Recap:</strong>
    const recapMatch = section.match(/<strong>\s*Trend Recap\s*:?\s*<\/strong>\s*([\s\S]{20,500}?)<\/p>/i)
    const rawHook = recapMatch
      ? recapMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
      : `Trending Instagram Reels format — ${trend_name}`
    const emotional_hook = decodeHtmlEntities(rawHook).slice(0, 200).trim()

    trends.push({ trend_name, audio_id, emotional_hook })
  }

  return trends
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, '')
}

// ─── Apify: find example reel for an audio ID ────────────────────────────────

async function findExampleReel(audioId: string): Promise<string | null> {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=55&memory=512`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/reels/audio/${audioId}/`],
          resultsLimit: 5,
        }),
        signal: AbortSignal.timeout(60000),
      }
    )
    if (!res.ok) return null

    const items = (await res.json()) as Record<string, unknown>[]

    // Pick most-commented post (likes are hidden on Instagram)
    const best = items
      .filter(p => (p.commentsCount as number) > 0 && p.shortCode)
      .sort((a, b) => (b.commentsCount as number) - (a.commentsCount as number))[0]

    return best?.shortCode
      ? `https://www.instagram.com/reel/${best.shortCode}/`
      : null
  } catch {
    return null
  }
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

  // ?reset=1 clears this week's instagram seeds so they can be refreshed
  if (request.nextUrl.searchParams.get('reset') === '1') {
    await supabase.from('scored_trends')
      .delete()
      .eq('platform', 'instagram')
      .eq('week_number', week_number)
      .eq('year', year)
    // Also clear any old audio-page entries from previous runs
    await supabase.from('scored_trends')
      .delete()
      .like('source_url', '%instagram.com/reels/audio/%')
  }

  // ?debug=1 returns raw HTML snippet and parsed section count for diagnosis
  if (request.nextUrl.searchParams.get('debug') === '1') {
    const res = await fetch(LATER_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    })
    const html = await res.text()
    const h3count = (html.match(/<h3/gi) || []).length
    const audioCount = (html.match(/reels\/audio/gi) || []).length
    const trendCount = (html.match(/Trend:/gi) || []).length
    const sections = html.split(/<h3[^>]*>/i)
    const firstSection = sections[1]?.slice(0, 800) ?? 'no h3 found'
    return NextResponse.json({
      status: res.status,
      htmlLength: html.length,
      h3count,
      audioCount,
      trendCount,
      firstH3Section: firstSection,
      first500chars: html.slice(0, 500),
    })
  }

  // Step 1 — scrape Later.com for current trends
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

  // Step 2 — find example reel URLs in parallel batches of 3
  const BATCH_SIZE = 3
  const withUrls: Array<DiscoveredTrend & { source_url: string }> = []

  for (let i = 0; i < discovered.length; i += BATCH_SIZE) {
    const batch = discovered.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async t => {
        const reelUrl = await findExampleReel(t.audio_id)
        return {
          ...t,
          // Fall back to audio page if no reel found
          source_url: reelUrl ?? `https://www.instagram.com/reels/audio/${t.audio_id}/`,
        }
      })
    )
    withUrls.push(...results)
  }

  const reelCount = withUrls.filter(t => t.source_url.includes('/reel/')).length

  // Step 3 — dedup against already-seeded source_urls
  const urls = withUrls.map(t => t.source_url)
  const { data: existing } = await supabase
    .from('scored_trends')
    .select('source_url')
    .in('source_url', urls)
  const existingUrls = new Set((existing || []).map(r => r.source_url))
  const fresh = withUrls.filter(t => !existingUrls.has(t.source_url))

  if (fresh.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'All trends already seeded for this week',
      discovered: discovered.length,
      reelLinks: reelCount,
      scored: 0,
    })
  }

  // Step 4 — score with Claude and upsert
  let scored = 0
  const errors: string[] = []

  for (const trend of fresh) {
    try {
      const normTrend: NormalisedTrend = {
        platform: 'instagram',
        trend_name: trend.trend_name,
        trend_type: 'audio',
        emotional_hook: trend.emotional_hook,
        engagement_volume: 100000, // Later.com = curated viral-scale trends
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

  return NextResponse.json({
    success: true,
    discovered: discovered.length,
    reelLinks: reelCount,
    audioFallbacks: discovered.length - reelCount,
    fresh: fresh.length,
    scored,
    errors,
  })
}
