import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // Vercel Pro: 60s for scoring batch
import { createServerClient } from '@/lib/supabase'
import { scoreTrendBatch } from '@/lib/scorer'
import {
  fetchDatasetItems,
  normaliseTikTokItem,
  aggregateInstagramHashtagTrends,
  aggregateAudioTrends,
  NormalisedTrend,
} from '@/lib/apify'
import type { RawTrend } from '@/types'

function validateSecret(request: NextRequest): boolean {
  const expected = process.env.APIFY_WEBHOOK_SECRET
  if (!expected) return true // skip validation if not set (dev)

  // Check both header and query param
  const headerSecret = request.headers.get('x-apify-webhook-secret')
  const querySecret = request.nextUrl.searchParams.get('secret')

  return headerSecret === expected || querySecret === expected
}

export async function POST(request: NextRequest) {
  console.log('[ingest] Received Apify webhook')

  if (!validateSecret(request)) {
    console.warn('[ingest] Invalid webhook secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json()
    console.log('[ingest] Payload eventType:', payload.eventType)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Apify sends the dataset ID in resource.defaultDatasetId
  const resource = payload.resource as Record<string, unknown> | undefined
  const datasetId = resource?.defaultDatasetId as string | undefined
  const actorId = (resource?.actId as string) || ''

  if (!datasetId) {
    console.warn('[ingest] No datasetId in payload')
    return NextResponse.json({ error: 'No datasetId in payload' }, { status: 400 })
  }

  // Determine platform from actor ID
  const isTikTok = actorId.includes('tiktok')
  const platform: 'instagram' | 'tiktok' = isTikTok ? 'tiktok' : 'instagram'

  console.log(`[ingest] Fetching dataset ${datasetId} for platform=${platform}`)

  let items: unknown[]
  try {
    items = await fetchDatasetItems(datasetId)
    console.log(`[ingest] Fetched ${items.length} items from dataset`)
  } catch (err) {
    console.error('[ingest] Failed to fetch dataset:', err)
    return NextResponse.json({ error: 'Failed to fetch Apify dataset' }, { status: 500 })
  }

  const rawItems = items as Record<string, unknown>[]
  const normalised: NormalisedTrend[] = []

  if (isTikTok) {
    for (const item of rawItems) {
      const norm = normaliseTikTokItem(item)
      if (norm) normalised.push(norm)
    }
    const audioTrends = aggregateAudioTrends(rawItems)
    console.log(`[ingest] Extracted ${audioTrends.length} audio trends from TikTok data`)
    normalised.push(...audioTrends)
  } else {
    const igTrends = aggregateInstagramHashtagTrends(rawItems)
    console.log(`[ingest] Aggregated ${igTrends.length} IG hashtag trends`)
    normalised.push(...igTrends)
  }

  console.log(`[ingest] Normalised ${normalised.length}/${items.length} items (inc. audio trends)`)

  if (normalised.length === 0) {
    return NextResponse.json({ message: 'No usable trends in payload', count: 0 })
  }

  // Insert into raw_trends
  const supabase = createServerClient()
  const { data: inserted, error: insertError } = await supabase
    .from('raw_trends')
    .insert(normalised)
    .select()

  if (insertError) {
    console.error('[ingest] DB insert error:', insertError)
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  console.log(`[ingest] Inserted ${inserted?.length} raw trends`)

  // Immediately score the batch
  try {
    await scoreTrendBatch(inserted as RawTrend[])
  } catch (err) {
    console.error('[ingest] Scoring failed (trends still saved):', err)
  }

  return NextResponse.json({
    message: 'Ingest complete',
    inserted: inserted?.length ?? 0,
  })
}
