import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { dedupeTrends, trendSignature } from '@/lib/dedupe'
import type { ScoredTrend } from '@/types'
export const dynamic = 'force-dynamic'

// Server-side read for the dashboard — uses the service-role key so it is not
// affected by Row Level Security on the anon key (which was returning 0 rows).

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export async function GET(request: NextRequest) {
  const now = new Date()
  const params = request.nextUrl.searchParams
  const week = Number(params.get('week')) || getWeekNumber(now)
  const year = Number(params.get('year')) || now.getFullYear()

  // ?diag=1 — dump the actual week/year values present so we can see why a filter misses
  if (params.get('diag') === '1') {
    const supabase = createServerClient()
    const { data } = await supabase
      .from('scored_trends')
      .select('week_number, year, trend_name')
    const groups: Record<string, number> = {}
    for (const r of data || []) {
      const key = `w${r.week_number}(${typeof r.week_number}) y${r.year}(${typeof r.year})`
      groups[key] = (groups[key] || 0) + 1
    }
    return NextResponse.json({ total: data?.length ?? 0, groups, sample: (data || []).slice(0, 3) })
  }

  try {
    const supabase = createServerClient(true)
    let usedWeek = week
    let usedYear = year

    let { data, error } = await supabase
      .from('scored_trends')
      .select('*')
      .eq('week_number', week)
      .eq('year', year)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Fallback: if the requested week is empty, show the most recent batch that
    // exists (guards against a week-number mismatch between seed and read).
    if (!data || data.length === 0) {
      const { data: latest } = await supabase
        .from('scored_trends')
        .select('*')
        .order('year', { ascending: false })
        .order('week_number', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(120)
      if (latest && latest.length > 0) {
        usedYear = latest[0].year as number
        usedWeek = latest[0].week_number as number
        data = latest.filter((r) => r.year === usedYear && r.week_number === usedWeek)
      }
    }

    // Collapse repeats (same idea from multiple sources / reworded)
    const trends = dedupeTrends((data as ScoredTrend[]) || [])

    // Tag each trend NEW vs seen-before by comparing to earlier weeks
    const { data: prior } = await supabase
      .from('scored_trends')
      .select('trend_name, week_number, year')
      .or(`year.lt.${usedYear},and(year.eq.${usedYear},week_number.lt.${usedWeek})`)
    const priorSigs = new Set((prior || []).map((p) => trendSignature(p.trend_name as string)))
    for (const t of trends) t.isNew = !priorSigs.has(trendSignature(t.trend_name))

    return NextResponse.json({ success: true, week: usedWeek, year: usedYear, trends })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
