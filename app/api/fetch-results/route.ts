import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  fetchDatasetItems,
  normaliseTikTokItem,
  normaliseInstagramItem,
  aggregateAudioTrends,
  NormalisedTrend,
} from '@/lib/apify'

export const maxDuration = 60

const APIFY_BASE = 'https://api.apify.com/v2'

async function getRunInfo(runId: string) {
  const apiKey = process.env.APIFY_API_KEY!
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
  if (!res.ok) throw new Error(`Apify run lookup failed: ${res.status}`)
  const json = await res.json()
  return { status: json.data.status as string, datasetId: json.data.defaultDatasetId as string }
}

async function fetchAndInsertRun(runId: string, platform: 'tiktok' | 'instagram') {
  const { status, datasetId } = await getRunInfo(runId)
  if (status !== 'SUCCEEDED') {
    return { runId, status, skipped: true, reason: `Run status: ${status} — try again soon` }
  }

  const items = await fetchDatasetItems(datasetId) as Record<string, unknown>[]
  const isTikTok = platform === 'tiktok'

  const normalised: NormalisedTrend[] = []
  for (const item of items) {
    const norm = isTikTok ? normaliseTikTokItem(item) : normaliseInstagramItem(item)
    if (norm) normalised.push(norm)
  }
  if (isTikTok) normalised.push(...aggregateAudioTrends(items))

  if (normalised.length === 0) {
    return { runId, status, skipped: true, reason: 'No usable items in dataset' }
  }

  const supabase = createServerClient()
  const { data: inserted, error } = await supabase.from('raw_trends').insert(normalised).select()
  if (error) throw new Error(`DB insert failed: ${error.message}`)

  return { runId, status, inserted: inserted?.length }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tiktokRunId = searchParams.get('tiktok')
  const igRunId = searchParams.get('ig')

  if (!tiktokRunId && !igRunId) {
    return NextResponse.json({ error: 'Pass ?tiktok=RUN_ID and/or ?ig=RUN_ID' }, { status: 400 })
  }

  const results = []
  if (tiktokRunId) results.push(await fetchAndInsertRun(tiktokRunId, 'tiktok'))
  if (igRunId) results.push(await fetchAndInsertRun(igRunId, 'instagram'))

  const totalInserted = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0)

  return NextResponse.json({
    success: true,
    results,
    next: totalInserted > 0
      ? 'Raw trends saved — now call /api/process-raw to score with Claude'
      : 'Nothing inserted',
  })
}
