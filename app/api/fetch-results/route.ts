import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreTrendBatch } from '@/lib/scorer'
import {
  fetchDatasetItems,
  normaliseTikTokItem,
  normaliseInstagramItem,
  aggregateAudioTrends,
  NormalisedTrend,
} from '@/lib/apify'
import type { RawTrend } from '@/types'

export const maxDuration = 60

const APIFY_BASE = 'https://api.apify.com/v2'

async function getRunDatasetId(runId: string): Promise<{ datasetId: string; status: string }> {
  const apiKey = process.env.APIFY_API_KEY!
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
  if (!res.ok) throw new Error(`Apify run lookup failed: ${res.status}`)
  const json = await res.json()
  return {
    status: json.data.status,
    datasetId: json.data.defaultDatasetId,
  }
}

async function processRun(runId: string, platform: 'tiktok' | 'instagram') {
  const { status, datasetId } = await getRunDatasetId(runId)
  if (status !== 'SUCCEEDED') {
    return { runId, status, skipped: true, reason: `Run not succeeded yet (${status})` }
  }

  const items = await fetchDatasetItems(datasetId) as Record<string, unknown>[]
  const isTikTok = platform === 'tiktok'

  const normalised: NormalisedTrend[] = []
  for (const item of items) {
    const norm = isTikTok ? normaliseTikTokItem(item) : normaliseInstagramItem(item)
    if (norm) normalised.push(norm)
  }

  if (isTikTok) {
    const audioTrends = aggregateAudioTrends(items)
    normalised.push(...audioTrends)
  }

  if (normalised.length === 0) {
    return { runId, status, skipped: true, reason: 'No normalisable items in dataset' }
  }

  const supabase = createServerClient()
  const { data: inserted, error } = await supabase
    .from('raw_trends')
    .insert(normalised)
    .select()

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  await scoreTrendBatch(inserted as RawTrend[])

  return { runId, status, normalised: normalised.length, scored: inserted?.length }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tiktokRunId = searchParams.get('tiktok')
  const igRunId = searchParams.get('ig')

  if (!tiktokRunId && !igRunId) {
    return NextResponse.json(
      { error: 'Pass ?tiktok=RUN_ID and/or ?ig=RUN_ID' },
      { status: 400 }
    )
  }

  const results = []
  if (tiktokRunId) results.push(await processRun(tiktokRunId, 'tiktok'))
  if (igRunId) results.push(await processRun(igRunId, 'instagram'))

  return NextResponse.json({ success: true, results })
}
