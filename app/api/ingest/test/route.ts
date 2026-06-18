import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const now = new Date()
const week = getWeekNumber(now)
const year = now.getFullYear()

// Pre-scored mock trends — inserted directly into scored_trends
// Bypasses Claude API call so demo loads instantly
const MOCK_SCORED = [
  {
    trend_name: '#BartenderPOV',
    platform: 'tiktok',
    trend_type: 'format',
    emotional_hook: 'Behind-the-bar POV going viral — aspirational, crafty, real craft',
    spike_pct: 420,
    chivas_score: 4, absolut_score: 3, jameson_score: 5, glenlivet_score: 3,
    top_brand: 'Jameson',
    opportunity_note: 'Jump on POV format — bartender prepping Jameson cocktails at speed',
    content_angle: 'First-person bar shift reel — real, unscripted, Jameson front and centre',
    source_url: 'https://www.tiktok.com/@barmanship/video/7312098765432109876',
    week_number: week, year,
  },
  {
    trend_name: '#DubaiNightlife',
    platform: 'tiktok',
    trend_type: 'hashtag',
    emotional_hook: 'FOMO-driven rooftop highlights — luxury, aspirational, Dubai elite',
    spike_pct: 180,
    chivas_score: 5, absolut_score: 4, jameson_score: 2, glenlivet_score: 3,
    top_brand: 'Chivas Regal',
    opportunity_note: 'Own the rooftop moment — Chivas as the drink of Dubai success',
    content_angle: 'Slow-mo golden hour Chivas pour on Dubai skyline rooftop',
    source_url: 'https://www.tiktok.com/@dubaidiaries/video/7298341256789012345',
    week_number: week, year,
  },
  {
    trend_name: 'Cocktail Cinematic Reel',
    platform: 'instagram',
    trend_type: 'format',
    emotional_hook: 'Hyper-aesthetic pour shots with moody lighting — premium, editorial',
    spike_pct: 210,
    chivas_score: 5, absolut_score: 3, jameson_score: 2, glenlivet_score: 4,
    top_brand: 'Chivas Regal',
    opportunity_note: 'Lead the aesthetic — Chivas cinematic pour as premium IG content',
    content_angle: 'Ultra slow-mo Chivas pour — moody lighting, no voiceover, pure craft',
    source_url: 'https://www.instagram.com/reel/C8kL2xMoP4N/',
    week_number: week, year,
  },
  {
    trend_name: '#GinAndTonic Challenge',
    platform: 'tiktok',
    trend_type: 'audio',
    emotional_hook: 'Vibrant, colourful city energy — people showing their G&T builds',
    spike_pct: 260,
    chivas_score: 2, absolut_score: 4, jameson_score: 3, glenlivet_score: 2,
    top_brand: 'Absolut Vodka',
    opportunity_note: 'Hijack trend — swap gin for Absolut in a bold creative G&T twist',
    content_angle: 'Creator-style recipe reel swapping gin for Absolut with vibrant garnishes',
    source_url: 'https://www.tiktok.com/@cocktailchemistry/video/7289654321098765432',
    week_number: week, year,
  },
  {
    trend_name: '#SlowMomentsCampaign',
    platform: 'tiktok',
    trend_type: 'hashtag',
    emotional_hook: 'Savoring the moment — golden hour, glass in hand, no rush',
    spike_pct: 340,
    chivas_score: 5, absolut_score: 2, jameson_score: 3, glenlivet_score: 4,
    top_brand: 'Chivas Regal',
    opportunity_note: 'Perfect brand fit — Chivas "slow down" ethos matches trend perfectly',
    content_angle: 'Single static shot — Chivas glass, golden light, no dialogue, pure mood',
    source_url: 'https://www.tiktok.com/@h_the_bartender/video/7316547823941289242',
    week_number: week, year,
  },
  {
    trend_name: 'Premium Scotch Unboxing',
    platform: 'instagram',
    trend_type: 'format',
    emotional_hook: 'Gift reveal — luxury packaging, suspense, gifting culture',
    spike_pct: 145,
    chivas_score: 5, absolut_score: 1, jameson_score: 2, glenlivet_score: 5,
    top_brand: 'The Glenlivet',
    opportunity_note: 'Glenlivet gift sets are perfect for this format — luxury unbox moment',
    content_angle: 'Unboxing Glenlivet gift set — tissue paper, card, reaction reveal',
    source_url: 'https://www.instagram.com/reel/C9pX3kLmN8Q/',
    week_number: week, year,
  },
  {
    trend_name: '#AbuDhabiNights',
    platform: 'tiktok',
    trend_type: 'hashtag',
    emotional_hook: 'Abu Dhabi luxury scene — sophisticated, aspirational, GCC elite',
    spike_pct: 195,
    chivas_score: 5, absolut_score: 3, jameson_score: 2, glenlivet_score: 4,
    top_brand: 'Chivas Regal',
    opportunity_note: 'Position Chivas as the drink of Abu Dhabi luxury occasions',
    content_angle: 'Chivas at Abu Dhabi skyline venue — prestige, brotherhood, celebration',
    source_url: 'https://www.tiktok.com/@uaelifestyle_/video/7301234567891234567',
    week_number: week, year,
  },
  {
    trend_name: 'Artful Pour Series',
    platform: 'instagram',
    trend_type: 'format',
    emotional_hook: 'Creative, abstract — cocktail making as visual art form',
    spike_pct: 115,
    chivas_score: 3, absolut_score: 5, jameson_score: 2, glenlivet_score: 3,
    top_brand: 'Absolut Vodka',
    opportunity_note: 'Absolut art direction is a natural — bold colours, expressive pour',
    content_angle: 'Abstract Absolut cocktail art reel — overhead pour, vivid colours',
    source_url: 'https://www.instagram.com/reel/C6tY4nMoR1S/',
    week_number: week, year,
  },
  {
    trend_name: 'Everyone Welcome Pub Night',
    platform: 'instagram',
    trend_type: 'format',
    emotional_hook: 'Inclusive, warm, unscripted gatherings — real people, real laughs',
    spike_pct: 95,
    chivas_score: 2, absolut_score: 3, jameson_score: 5, glenlivet_score: 1,
    top_brand: 'Jameson',
    opportunity_note: 'Jameson "everyone welcome" ethos is this trend — own it immediately',
    content_angle: 'Unscripted group toast video — Jameson, friends, zero production value',
    source_url: 'https://www.instagram.com/reel/C7mN8pQrS2T/',
    week_number: week, year,
  },
  {
    trend_name: 'Irish Warmth Reel Format',
    platform: 'instagram',
    trend_type: 'format',
    emotional_hook: 'Friendship toasts, group laughs, pub-style warmth — zero pretense',
    spike_pct: 88,
    chivas_score: 2, absolut_score: 2, jameson_score: 5, glenlivet_score: 1,
    top_brand: 'Jameson',
    opportunity_note: 'Authentic Jameson content — real moments, pub energy, no script',
    content_angle: 'UGC-style Jameson toast reel — messy, warm, real pub atmosphere',
    source_url: 'https://www.instagram.com/reel/C5sW7mNpQ3T/',
    week_number: week, year,
  },
]

export async function GET() {
  console.log('[ingest/test] Inserting pre-scored mock trends directly')
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('scored_trends')
    .insert(MOCK_SCORED)
    .select()

  if (error) {
    console.error('[ingest/test] Insert error:', error)
    return NextResponse.json({ error: 'Insert failed', detail: error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    inserted: data?.length,
    message: `${data?.length} trends ready on dashboard`,
  })
}
