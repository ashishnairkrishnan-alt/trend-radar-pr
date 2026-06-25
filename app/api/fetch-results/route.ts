import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreTikTokPost } from '@/lib/scorer'
import {
  fetchDatasetItems,
  calcEngagement,
  normaliseTikTokPost,
  deriveTrendName,
  deriveTrendType,
} from '@/lib/apify'

export const maxDuration = 60

const APIFY_BASE = 'https://api.apify.com/v2'
const MIN_ENGAGEMENT = 1000
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

  // 1. Fetch raw items from Apify dataset
  const rawItems = await fetchDatasetItems(datasetId) as Record<string, unknown>[]
  console.log(`[fetch-results] Fetched ${rawItems.length} raw items`)

  // 2. Normalise + filter by engagement
  const posts = rawItems
    .map(item => {
      const post = normaliseTikTokPost(item)
      if (!post) return null
      const eng = calcEngagement(item)
      if (eng < MIN_ENGAGEMENT) return null
      return { post, engagementScore: eng }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.engagementScore - a.engagementScore)

  console.log(`[fetch-results] ${posts.length} posts passed engagement filter (>= ${MIN_ENGAGEMENT})`)

  if (posts.length === 0) return { datasetId, skipped: true, reason: 'No posts passed engagement filter' }

  // 3. Batch dedup — skip source_urls already in scored_trends
  const candidateUrls = posts.map(p => p.post.webVideoUrl).filter(Boolean) as string[]
  const { data: existing } = await supabase
    .from('scored_trends')
    .select('source_url')
    .in('source_url', candidateUrls)
  const existingUrls = new Set((existing || []).map(r => r.source_url))

  const fresh = posts.filter(p => p.post.webVideoUrl && !existingUrls.has(p.post.webVideoUrl))
  console.log(`[fetch-results] ${fresh.length} posts after dedup (${existingUrls.size} already exist)`)

  if (fresh.length === 0) return { datasetId, skipped: true, reason: 'All posts already scored' }

  // 4. Count music occurrences → save top 3 trending audios
  const musicCounts = new Map<string, { author: string; count: number }>()
  for (const { post } of fresh) {
    const name = post.musicMeta.musicName
    const author = post.musicMeta.musicAuthor || ''
    if (name && post.musicMeta.musicOriginal === false) {
      const existing = musicCounts.get(name)
      if (existing) existing.count++
      else musicCounts.set(name, { author, count: 1 })
    }
  }

  const topAudio = Array.from(musicCounts.entries())
    .map(([name, { author, count }]) => ({ name, author, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  for (const audio of topAudio) {
    await supabase.from('trending_audio').upsert({
      music_name: audio.name,
      music_author: audio.author,
      post_count: audio.count,
      week_date: weekDate,
    }, { onConflict: 'music_name,week_date' })
  }
  console.log(`[fetch-results] Saved ${topAudio.length} trending audio entries`)

  // 5. Score top posts with Claude (cap to avoid timeout)
  const toScore = fresh.slice(0, MAX_TO_SCORE)
  let scored = 0

  for (const { post, engagementScore } of toScore) {
    try {
      const scores = await scoreTikTokPost(post)
      const trendName = cleanText(deriveTrendName(post), 100)
      const trendType = deriveTrendType(post)
      const sourceUrl = (post.webVideoUrl || '').slice(0, 500)

      const { error } = await supabase.from('scored_trends').upsert({
        trend_name: trendName,
        platform: 'tiktok',
        trend_type: trendType,
        emotional_hook: cleanText(post.text, 200),
        spike_pct: 0,
        source_url: sourceUrl,
        week_number,
        year,
        engagement_score: Math.round(engagementScore),
        music_name: post.musicMeta.musicName || null,
        music_author: post.musicMeta.musicAuthor || null,
        music_is_trending: post.musicMeta.musicOriginal === false,
        ...scores,
      }, { onConflict: 'source_url', ignoreDuplicates: true })

      if (error) console.error(`[fetch-results] Upsert error for "${trendName}":`, error.message)
      else scored++
    } catch (err) {
      console.error(`[fetch-results] Scoring failed for post ${post.id}:`, err)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  return {
    datasetId,
    rawFetched: rawItems.length,
    passedEngagementFilter: posts.length,
    afterDedup: fresh.length,
    trendingAudioSaved: topAudio.length,
    scored,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const runId = searchParams.get('run')
  const datasetId = searchParams.get('tt_dataset') || searchParams.get('tiktok')
  const debug = searchParams.get('debug') === '1'

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

    // Debug mode: dump all keys of first raw item to find real field names
    if (debug) {
      const rawItems = await fetchDatasetItems(targetDatasetId) as Record<string, unknown>[]
      const first = rawItems[0] || {}
      return NextResponse.json({
        debug: true,
        total: rawItems.length,
        firstItemKeys: Object.keys(first),
        firstItem: first,
      })
    }

    const result = await processTikTokDataset(targetDatasetId)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('[fetch-results] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
