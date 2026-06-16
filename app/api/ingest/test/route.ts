import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreTrendBatch } from '@/lib/scorer'
import type { RawTrend } from '@/types'

// Mock Apify payload — simulates what real scrapers return
// source_url points to the actual TikTok/IG content being tracked
const MOCK_RAW_TRENDS: Omit<RawTrend, 'id' | 'created_at' | 'processed'>[] = [
  {
    platform: 'tiktok',
    trend_name: '#SlowMomentsCampaign',
    trend_type: 'hashtag',
    emotional_hook: 'Savoring the moment — golden hour, glass in hand, no rush',
    engagement_volume: 4_200_000,
    spike_pct: 340,
    source_url: 'https://www.tiktok.com/tag/slowmoments',
    raw_data: { source: 'mock', cluster: 'nightlife' },
  },
  {
    platform: 'instagram',
    trend_name: 'Cocktail Cinematic Reel',
    trend_type: 'format',
    emotional_hook: 'Hyper-aesthetic pouring shots with moody lighting — feels premium',
    engagement_volume: 1_800_000,
    spike_pct: 210,
    source_url: 'https://www.instagram.com/explore/tags/cocktailcinematic/',
    raw_data: { source: 'mock', cluster: 'mixology' },
  },
  {
    platform: 'tiktok',
    trend_name: '#DubaiNightlife',
    trend_type: 'hashtag',
    emotional_hook: 'FOMO-driven nightlife highlights from Dubai rooftop venues',
    engagement_volume: 9_500_000,
    spike_pct: 180,
    source_url: 'https://www.tiktok.com/tag/dubainightlife',
    raw_data: { source: 'mock', cluster: 'mena' },
  },
  {
    platform: 'instagram',
    trend_name: 'Everyone Welcome Pub Night',
    trend_type: 'format',
    emotional_hook: 'Inclusive, warm, unscripted gatherings — real people, real laughs',
    engagement_volume: 650_000,
    spike_pct: 95,
    source_url: 'https://www.instagram.com/explore/tags/pubnightout/',
    raw_data: { source: 'mock', cluster: 'nightlife' },
  },
  {
    platform: 'tiktok',
    trend_name: '#GinAndTonic Challenge',
    trend_type: 'audio',
    emotional_hook: 'Vibrant, colourful, city-energy — people showing their G&T recipes',
    engagement_volume: 3_100_000,
    spike_pct: 260,
    source_url: 'https://www.tiktok.com/tag/ginandtonic',
    raw_data: { source: 'mock', cluster: 'brand-adjacent' },
  },
  {
    platform: 'instagram',
    trend_name: 'Premium Scotch Unboxing',
    trend_type: 'format',
    emotional_hook: 'Gift reveal — luxury packaging, suspense, gifting culture',
    engagement_volume: 2_200_000,
    spike_pct: 145,
    source_url: 'https://www.instagram.com/explore/tags/scotchwhisky/',
    raw_data: { source: 'mock', cluster: 'brand-adjacent' },
  },
  {
    platform: 'tiktok',
    trend_name: '#FYP Bartender POV',
    trend_type: 'format',
    emotional_hook: 'Behind-the-bar POV videos going viral — aspirational, crafty',
    engagement_volume: 7_800_000,
    spike_pct: 420,
    source_url: 'https://www.tiktok.com/tag/bartenderlife',
    raw_data: { source: 'mock', cluster: 'viral' },
  },
  {
    platform: 'instagram',
    trend_name: 'Artful Pour Series',
    trend_type: 'format',
    emotional_hook: 'Creative, abstract, expressive — cocktail making as visual art',
    engagement_volume: 1_200_000,
    spike_pct: 115,
    source_url: 'https://www.instagram.com/explore/tags/mixology/',
    raw_data: { source: 'mock', cluster: 'mixology' },
  },
  {
    platform: 'tiktok',
    trend_name: '#DohaVibes',
    trend_type: 'hashtag',
    emotional_hook: 'Qatar hospitality meets modern nightlife — upscale social moments',
    engagement_volume: 3_200_000,
    spike_pct: 195,
    source_url: 'https://www.tiktok.com/tag/dohavibes',
    raw_data: { source: 'mock', cluster: 'mena' },
  },
  {
    platform: 'instagram',
    trend_name: 'Irish Warmth Reel Format',
    trend_type: 'format',
    emotional_hook: 'Friendship toasts, group laughs, pub-style warmth — zero pretense',
    engagement_volume: 890_000,
    spike_pct: 88,
    source_url: 'https://www.instagram.com/explore/tags/irishwhiskey/',
    raw_data: { source: 'mock', cluster: 'nightlife' },
  },
]

export async function GET() {
  console.log('[ingest/test] Firing mock ingest with 10 test trends')

  const supabase = createServerClient()

  const { data: inserted, error: insertError } = await supabase
    .from('raw_trends')
    .insert(MOCK_RAW_TRENDS)
    .select()

  if (insertError) {
    console.error('[ingest/test] DB insert error:', insertError)
    return NextResponse.json({ error: 'DB insert failed', detail: insertError }, { status: 500 })
  }

  console.log(`[ingest/test] Inserted ${inserted?.length} mock raw trends`)

  try {
    await scoreTrendBatch(inserted as RawTrend[])
  } catch (err) {
    console.error('[ingest/test] Scoring error:', err)
    return NextResponse.json({
      warning: 'Trends inserted but scoring failed',
      inserted: inserted?.length,
      error: String(err),
    })
  }

  return NextResponse.json({
    message: 'Mock ingest + scoring complete',
    inserted: inserted?.length,
  })
}
