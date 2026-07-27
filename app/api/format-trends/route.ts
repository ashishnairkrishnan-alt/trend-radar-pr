import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getWeekNumber, rowToTrend } from '@/lib/formatStore'

export const dynamic = 'force-dynamic'

// Fast read of this week's stored static/carousel trends (service role, bypasses
// RLS). No scraping here — the weekly cron populates the table.
export async function GET() {
  try {
    const supabase = createServerClient()
    const now = new Date()
    const week = getWeekNumber(now)
    const year = now.getFullYear()

    const { data, error } = await supabase
      .from('format_trends')
      .select('*')
      .eq('week_number', week)
      .eq('year', year)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    const trends = (data || []).map(rowToTrend)
    const counts = {
      static: trends.filter((t) => t.format === 'Static').length,
      carousel: trends.filter((t) => t.format === 'Carousel').length,
    }
    return NextResponse.json({ success: true, count: trends.length, week, year, counts, trends })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
