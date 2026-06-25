import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import {
  fetchDatasetItems,
  aggregateHashtagTrends,
  aggregateAudioTrends,
} from '@/lib/apify'

export const maxDuration = 60

const APIFY_BASE = 'https://api.apify.com/v2'
const MAX_TO_SCORE = 12

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getWeekStartDate(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

function cleanText(s: string, max = 200): string {
  return (s || '').replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, max).trim()
}

async function getRunDatasetId(runId: string): Promise<{ status: string; datasetId: string }> {
  const apiKey = process.env.APIFY_API_KEY!
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
  if (!res.ok) throw new Error(`Apify run lookup failed: ${res.status}`)
  const json = await res.json()
  return { status: json.data.status, datasetId: json.data.defaultDatasetId }
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

async function processTikTokDataset(datasetId: string) {
  const supabase = createServerClient()
  const now = new Date()
  const week_number = getWeekNumber(now)
  const year = now.getFullYear()
  const weekDate = getWeekStartDate(now)

  // 1. Fetch raw items
  const rawItems = await fetchDatasetItems(datasetId) as Record<string, unknown>[]
  console.log(`[fetch-results] Fetched ${rawItems.length} raw items`)

  // 2. Aggregate into trend clusters (hashtags appearing in 2+ posts, sounds in 2+ posts)
  const hashtagTrends = aggregateHashtagTrends(rawItems)
  const audioTrends = aggregateAudioTrends(rawItems)
  console.log(`[fetch-results] Aggregated: ${hashtagTrends.length} hashtag trends, ${audioTrends.length} audio trends`)

  // 3. Save top 3 trending audio entries
  for (const audio of audioTrends.slice(0, 3)) {
    const raw = audio.raw_data as Record<string, unknown>
    await supabase.from('trending_audio').upsert({
      music_name: raw.musicName as string,
      music_author: (raw.musicAuthor as string) || null,
      post_count: (raw.videoCount as number) || 1,
      week_date: weekDate,
    }, { onConflict: 'music_name,week_date' })
  }

  // 4. Merge and sort by engagement, dedup against existing source_urls
  const allTrends = [...hashtagTrends, ...audioTrends]
    .sort((a, b) => b.engagement_volume - a.engagement_volume)

  if (allTrends.length === 0) return { datasetId, skipped: true, reason: 'No trends after aggregation (need 2+ posts per hashtag/sound)' }

  const candidateUrls = allTrends.map(t => t.source_url).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('scored_trends')
    .select('source_url')
    .in('source_url', candidateUrls)
  const existingUrls = new Set((existingRows || []).map(r => r.source_url))
  const fresh = allTrends.filter(t => t.source_url && !existingUrls.has(t.source_url))
  console.log(`[fetch-results] ${fresh.length} fresh trends after dedup`)

  if (fresh.length === 0) return { datasetId, skipped: true, reason: 'All trends already scored' }

  // 5. Score top trends with Claude
  const toScore = fresh.slice(0, MAX_TO_SCORE)
  let scored = 0

  for (const trend of toScore) {
    try {
      const scores = await scoreNormalisedTrend(trend)
      const raw = trend.raw_data as Record<string, unknown>

      const { error } = await supabase.from('scored_trends').upsert({
        trend_name: cleanText(trend.trend_name, 100),
        platform: trend.platform,
        trend_type: trend.trend_type,
        emotional_hook: cleanText(trend.emotional_hook, 200),
        spike_pct: trend.spike_pct,
        source_url: trend.source_url.slice(0, 500),
        week_number,
        year,
        engagement_score: Math.round(trend.engagement_volume),
        music_name: (raw.musicName as string) || null,
        music_author: (raw.musicAuthor as string) || null,
        music_is_trending: trend.trend_type === 'audio',
        ...scores,
      }, { onConflict: 'source_url', ignoreDuplicates: true })

      if (error) console.error(`[fetch-results] Upsert error for "${trend.trend_name}":`, error.message)
      else scored++
    } catch (err) {
      console.error(`[fetch-results] Scoring failed for trend "${trend.trend_name}":`, err)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return {
    datasetId,
    rawFetched: rawItems.length,
    hashtagTrends: hashtagTrends.length,
    audioTrends: audioTrends.length,
    afterDedup: fresh.length,
    trendingAudioSaved: Math.min(audioTrends.length, 3),
    scored,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const runId = searchParams.get('run')
  const datasetId = searchParams.get('tt_dataset') || searchParams.get('tiktok')

  try {
    let targetDatasetId = datasetId

    if (!targetDatasetId && runId) {
      const { status, datasetId: ds } = await getRunDatasetId(runId)
      if (status !== 'SUCCEEDED') {
        return NextResponse.json({ skipped: true, reason: `Run status: ${status} — try again soon` })
      }
      targetDatasetId = ds
    }

    if (!targetDatasetId) {
      return NextResponse.json({
        error: 'Pass ?tt_dataset=DATASET_ID or ?run=RUN_ID'
      }, { status: 400 })
    }

    const result = await processTikTokDataset(targetDatasetId)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[fetch-results] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
