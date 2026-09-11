import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { scoreNormalisedTrend } from '@/lib/scorer'
import type { NormalisedTrend } from '@/lib/apify'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Manually add a single trend the automated scrapers don't cover (e.g. an
// AI-image trend that isn't in the Later.com / holler.academy roundups). It is
// scored by the SAME brand scorer and stored in the current week's batch, so it
// shows on the dashboard and is included in the next digest send.
//
// Usage (all optional except it defaults to the 80s AI trend):
//   /api/add-trend?name=...&hook=...&platform=instagram&type=format&source_url=...
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function clean(s: string, max: number): string {
  return (s || '').replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, max).trim()
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams

  const name = clean(
    p.get('name') || 'Your 80s AI version',
    100
  )
  const hook = clean(
    p.get('hook') ||
      'Upload your photo to an AI image tool and get a nostalgic 80s-styled portrait back. Retro, playful, and highly shareable.',
    200
  )
  const platform = (p.get('platform') === 'tiktok' ? 'tiktok' : 'instagram') as 'instagram' | 'tiktok'
  const trend_type = (p.get('type') || 'format') as NormalisedTrend['trend_type']
  const source_url = clean(
    p.get('source_url') || 'https://www.google.com/search?q=80s+AI+version+photo+trend',
    500
  )

  try {
    const normTrend: NormalisedTrend = {
      platform,
      trend_name: name,
      trend_type,
      emotional_hook: hook,
      engagement_volume: 100000,
      spike_pct: 85,
      source_url,
      raw_data: { manual: true },
    }

    const scores = await scoreNormalisedTrend(normTrend)

    const supabase = createServerClient()
    const now = new Date()

    // Add it to the SAME batch that's currently live (the most recent week that
    // has trends), so it appears alongside them on the dashboard and in the
    // digest. Falls back to the current ISO week only if the table is empty.
    let week_number = getWeekNumber(now)
    let year = now.getFullYear()
    const { data: latest } = await supabase
      .from('scored_trends')
      .select('week_number, year')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .limit(1)
    if (latest && latest.length > 0) {
      year = latest[0].year as number
      week_number = latest[0].week_number as number
    }

    const { error } = await supabase.from('scored_trends').upsert(
      {
        trend_name: name,
        platform,
        trend_type,
        emotional_hook: hook,
        spike_pct: 85,
        source_url,
        week_number,
        year,
        engagement_score: 100000,
        ...scores,
      },
      { onConflict: 'source_url', ignoreDuplicates: false }
    )

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      added: { trend_name: name, platform, trend_type, week_number, year, ...scores },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
