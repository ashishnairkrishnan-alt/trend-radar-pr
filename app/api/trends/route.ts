import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { ScoredTrend } from '@/types'

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

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('scored_trends')
      .select('*')
      .eq('week_number', week)
      .eq('year', year)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, week, year, trends: (data as ScoredTrend[]) || [] })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
