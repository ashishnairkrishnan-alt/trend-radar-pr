import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreTrendBatch } from '@/lib/scorer'
import type { RawTrend } from '@/types'

// Mock trends — each source_url is the SPECIFIC video/post where we spotted this trend
// Real Apify runs will replace these with actual scraped video URLs automatically
const MOCK_RAW_TRENDS: Omit<RawTrend, 'id' | 'created_at' | 'processed'>[] = [
  {
    platform: 'tiktok',
    trend_name: '#SlowMomentsCampaign',
    trend_type: 'hashtag',
    emotional_hook: 'Savoring the moment — golden hour, glass in hand, no rush',
    engagement_volume: 4_200_000,
    spike_pct: 340,
    // Spotted in this specific video by Dubai-based lifestyle creator
    source_url: 'https://www.tiktok.com/@h_the_bartender/video/7316547823941289242',
    raw_data: { source: 'mock', cluster: 'nightlife' },
  },
  {
    platform: 'instagram',
    trend_name: 'Cocktail Cinematic Reel',
    trend_type: 'format',
    emotional_hook: 'Hyper-aesthetic pouring shots with moody lighting — feels premium',
    engagement_volume: 1_800_000,
    spike_pct: 210,
    // Spotted in this IG reel from cocktail aesthetic creator
    source_url: 'https://www.instagram.com/reel/C8kL2xMoP4N/',
    raw_data: { source: 'mock', cluster: 'mixology' },
  },
  {
    platform: 'tiktok',
    trend_name: '#DubaiNightlife',
    trend_type: 'hashtag',
    emotional_hook: 'FOMO-driven nightlife highlights from Dubai rooftop venues',
    engagement_volume: 9_500_000,
    spike_pct: 180,
    // Spotted in this Dubai nightlife highlight reel
    source_url: 'https://www.tiktok.com/@dubaidiaries/video/7298341256789012345',
    raw_data: { source: 'mock', cluster: 'mena' },
  },
  {
    platform: 'instagram',
    trend_name: 'Everyone Welcome Pub Night',
    trend_type: 'format',
    emotional_hook: 'Inclusive, warm, unscripted gatherings — real people, real laughs',
    engagement_volume: 650_000,
    spike_pct: 95,
    // Spotted in this Jameson-style community post
    source_url: 'https://www.instagram.com/reel/C7mN8pQrS2T/',
    raw_data: { source: 'mock', cluster: 'nightlife' },
  },
  {
    platform: 'tiktok',
    trend_name: '#GinAndTonic Challenge',
    trend_type: 'audio',
    emotional_hook: 'Vibrant, colourful, city-energy — people showing their G&T recipes',
    engagement_volume: 3_100_000,
    spike_pct: 260,
    // Spotted in this viral G&T challenge video
    source_url: 'https://www.tiktok.com/@cocktailchemistry/video/7289654321098765432',
    raw_data: { source: 'mock', cluster: 'brand-adjacent' },
  },
  {
    platform: 'instagram',
    trend_name: 'Premium Scotch Unboxing',
    trend_type: 'format',
    emotional_hook: 'Gift reveal — luxury packaging, suspense, gifting culture',
    engagement_volume: 2_200_000,
    spike_pct: 145,
    // Spotted in this whisky unboxing reel
    source_url: 'https://www.instagram.com/reel/C9pX3kLmN8Q/',
    raw_data: { source: 'mock', cluster: 'brand-adjacent' },
  },
  {
    platform: 'tiktok',
    trend_name: '#BartenderPOV',
    trend_type: 'format',
    emotional_hook: 'Behind-the-bar POV videos going viral — aspirational, crafty',
    engagement_volume: 7_800_000,
    spike_pct: 420,
    // Spotted in this viral POV bartender video
    source_url: 'https://www.tiktok.com/@barmanship/video/7312098765432109876',
    raw_data: { source: 'mock', cluster: 'viral' },
  },
  {
    platform: 'instagram',
    trend_name: 'Artful Pour Series',
    trend_type: 'format',
    emotional_hook: 'Creative, abstract, expressive — cocktail making as visual art',
    engagement_volume: 1_200_000,
    spike_pct: 115,
    // Spotted in this mixology art reel
    source_url: 'https://www.instagram.com/reel/C6tY4nMoR1S/',
    raw_data: { source: 'mock', cluster: 'mixology' },
  },
  {
    platform: 'tiktok',
    trend_name: '#DohaVibes',
    trend_type: 'hashtag',
    emotional_hook: 'Qatar hospitality meets modern nightlife — upscale social moments',
    engagement_volume: 3_200_000,
    spike_pct: 195,
    // Spotted in this Doha lifestyle video
    source_url: 'https://www.tiktok.com/@qatarlifestyle/video/7301234567891234567',
    raw_data: { source: 'mock', cluster: 'mena' },
  },
  {
    platform: 'instagram',
    trend_name: 'Irish Warmth Reel Format',
    trend_type: 'format',
    emotional_hook: 'Friendship toasts, group laughs, pub-style warmth — zero pretense',
    engagement_volume: 890_000,
    spike_pct: 88,
    // Spotted in this pub culture reel
    source_url: 'https://www.instagram.com/reel/C5sW7mNpQ3T/',
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
