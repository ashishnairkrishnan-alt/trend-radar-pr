import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateFormatTrends } from '@/lib/formatTrends'
import { getWeekNumber, trendToRow } from '@/lib/formatStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Weekly generator: scrape + vision ONCE, store the static/carousel trends for
// this week. The page and the Monday email then read the stored rows (instant,
// no per-view scrape). Only clears the week's old rows AFTER a successful generate.
export async function GET() {
  try {
    const trends = await generateFormatTrends()
    if (trends.length === 0) {
      return NextResponse.json({ success: false, error: 'No trends generated - nothing stored (kept existing rows).' }, { status: 404 })
    }

    const supabase = createServerClient()
    const now = new Date()
    const week_number = getWeekNumber(now)
    const year = now.getFullYear()

    await supabase.from('format_trends').delete().eq('week_number', week_number).eq('year', year)
    const rows = trends.map((t) => trendToRow(t, week_number, year))
    const { error } = await supabase.from('format_trends').insert(rows)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, stored: rows.length, week_number, year })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
