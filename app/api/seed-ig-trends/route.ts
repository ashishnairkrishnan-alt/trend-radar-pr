import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import type { NormalisedTrend } from '@/lib/apify'

export const maxDuration = 60

// June 2026 Instagram Reels trends — sourced from Later.com
// These are curated, named trends with real cultural momentum.
const JUNE_2026_TRENDS: Omit<NormalisedTrend, 'raw_data'>[] = [
  {
    platform: 'instagram',
    trend_name: 'The Summer Schedule',
    trend_type: 'audio',
    emotional_hook: 'Visual loop format showing daily routines with multiple hook points — romanticising everyday summer life',
    engagement_volume: 95000,
    spike_pct: 85,
    source_url: 'https://www.instagram.com/reels/audio/202891871734130/',
  },
  {
    platform: 'instagram',
    trend_name: 'What You Want',
    trend_type: 'audio',
    emotional_hook: 'Confident product/service showcase highlighting brand offerings — set to Respect by Aretha Franklin',
    engagement_volume: 120000,
    spike_pct: 90,
    source_url: 'https://www.instagram.com/reels/audio/515371218997711/',
  },
  {
    platform: 'instagram',
    trend_name: 'Plan ABC',
    trend_type: 'audio',
    emotional_hook: 'Revealing alternate life paths from dream scenario to chaos to acceptance — relatable multi-outcome storytelling',
    engagement_volume: 72000,
    spike_pct: 70,
    source_url: 'https://www.instagram.com/reels/audio/26885590624412674/',
  },
  {
    platform: 'instagram',
    trend_name: 'Too Shy to Take Pics in Public',
    trend_type: 'audio',
    emotional_hook: 'Contrast between self-conscious person and enthusiastic photographer doing extreme shoots — set to Speed Demon by Justin Bieber',
    engagement_volume: 105000,
    spike_pct: 88,
    source_url: 'https://www.instagram.com/reels/audio/1279574933274134/',
  },
  {
    platform: 'instagram',
    trend_name: 'Do You Wanna?',
    trend_type: 'audio',
    emotional_hook: 'Posing questions then immediately showing yourself doing the activity fully committed — set to Human Nature by Michael Jackson',
    engagement_volume: 98000,
    spike_pct: 82,
    source_url: 'https://www.instagram.com/reels/audio/1066931830157201/',
  },
  {
    platform: 'instagram',
    trend_name: 'Girl Grip',
    trend_type: 'audio',
    emotional_hook: "Carrying entire life's essentials in one hand with confidence — set to I'm Every Woman by Chaka Khan",
    engagement_volume: 115000,
    spike_pct: 92,
    source_url: 'https://www.instagram.com/reels/audio/1715351118547270/',
  },
  {
    platform: 'instagram',
    trend_name: 'Jujutsu Kaisen Poses',
    trend_type: 'audio',
    emotional_hook: 'Group striking signature poses while holding key items — rapid-fire person-to-person transitions, high-energy team content',
    engagement_volume: 135000,
    spike_pct: 95,
    source_url: 'https://www.instagram.com/reels/audio/26868761529403213/',
  },
  {
    platform: 'instagram',
    trend_name: 'Lens Wipe Transition',
    trend_type: 'audio',
    emotional_hook: 'Wiping lens to reveal new scene or transformation — clean, satisfying visual format for product reveals',
    engagement_volume: 78000,
    spike_pct: 75,
    source_url: 'https://www.instagram.com/reels/audio/26923322580669821/',
  },
  // May 2026 carryover trends
  {
    platform: 'instagram',
    trend_name: "Don't Post Your Work, Post You Working",
    trend_type: 'audio',
    emotional_hook: 'Behind-the-scenes process content emphasising relatability over polished results — authenticity-first format gaining massive traction',
    engagement_volume: 145000,
    spike_pct: 98,
    source_url: 'https://www.instagram.com/reels/audio/26386920184265226/',
  },
  {
    platform: 'instagram',
    trend_name: 'Brainwash You',
    trend_type: 'audio',
    emotional_hook: 'Positioning yourself as the solution to audience problems and building trust quickly — confidence-driven brand format',
    engagement_volume: 110000,
    spike_pct: 87,
    source_url: 'https://www.instagram.com/reels/audio/3762108120781128/',
  },
  {
    platform: 'instagram',
    trend_name: "You're So Creative",
    trend_type: 'audio',
    emotional_hook: 'Showcasing creative work with humorous explanation of creative identity — set to One Less Lonely Girl by Justin Bieber',
    engagement_volume: 92000,
    spike_pct: 80,
    source_url: 'https://www.instagram.com/reels/audio/2206590442923471/',
  },
  {
    platform: 'instagram',
    trend_name: "You Think I'm Pretty?",
    trend_type: 'audio',
    emotional_hook: 'Asking about obsession with something while subject acts unbothered — luxury product and lifestyle showcase format',
    engagement_volume: 88000,
    spike_pct: 78,
    source_url: 'https://www.instagram.com/reels/audio/9573873819403156/',
  },
]

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

export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  // ?reset=1 clears previously seeded Later.com trends before re-inserting with IG URLs
  if (request.nextUrl.searchParams.get('reset') === '1') {
    await supabase.from('scored_trends')
      .delete()
      .like('source_url', '%later.com%')
  }
  const now = new Date()
  const week_number = getWeekNumber(now)
  const year = now.getFullYear()

  // Dedup against existing source_urls
  const urls = JUNE_2026_TRENDS.map(t => t.source_url)
  const { data: existing } = await supabase.from('scored_trends').select('source_url').in('source_url', urls)
  const existingUrls = new Set((existing || []).map(r => r.source_url))
  const fresh = JUNE_2026_TRENDS.filter(t => !existingUrls.has(t.source_url))

  if (fresh.length === 0) {
    return NextResponse.json({ success: true, message: 'All trends already seeded', scored: 0 })
  }

  let scored = 0
  const errors: string[] = []

  for (const trend of fresh) {
    try {
      const scores = await scoreNormalisedTrend({ ...trend, raw_data: {} })

      const { error } = await supabase.from('scored_trends').upsert({
        trend_name: cleanText(trend.trend_name, 100),
        platform: trend.platform,
        trend_type: trend.trend_type,
        emotional_hook: cleanText(trend.emotional_hook, 200),
        spike_pct: trend.spike_pct,
        source_url: trend.source_url,
        week_number,
        year,
        engagement_score: trend.engagement_volume,
        ...scores,
      }, { onConflict: 'source_url', ignoreDuplicates: true })

      if (error) errors.push(`${trend.trend_name}: ${error.message}`)
      else scored++
    } catch (err) {
      errors.push(`${trend.trend_name}: ${String(err)}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({ success: true, seeded: fresh.length, scored, errors })
}
