import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rowToTrend } from '@/lib/formatStore'

export const dynamic = 'force-dynamic'

// Fast read (service role, bypasses RLS). Returns the MOST RECENT stored batch —
// no fragile "current week" matching, so a stored batch always shows up.
export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('format_trends')
      .select('*')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(60)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    const all = data || []
    if (all.length === 0) {
      return NextResponse.json({ success: true, count: 0, totalRows: 0, trends: [], counts: { static: 0, carousel: 0 } })
    }

    // Keep only the latest (year, week_number) batch
    const topYear = all[0].year
    const topWeek = all[0].week_number
    const batch = all.filter((r) => r.year === topYear && r.week_number === topWeek)
    const trends = batch.map(rowToTrend)
    const counts = {
      static: trends.filter((t) => t.format === 'Static').length,
      carousel: trends.filter((t) => t.format === 'Carousel').length,
    }
    return NextResponse.json({ success: true, count: trends.length, totalRows: all.length, week: topWeek, year: topYear, counts, trends })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
