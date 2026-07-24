import { NextResponse } from 'next/server'
import { generateFormatTrends } from '@/lib/formatTrends'

// READ-ONLY preview endpoint (isolated page on the stable domain).
// Delegates to the shared generator so the page and the Monday email stay in sync.
// No DB writes. Live-scrapes on request — the scheduled/stored version comes later.
export const maxDuration = 300

export async function GET() {
  try {
    const trends = await generateFormatTrends()
    if (trends.length === 0) {
      return NextResponse.json({ success: false, error: 'Could not read any trends from the roundup slides.' }, { status: 404 })
    }
    const counts = {
      static: trends.filter((t) => t.format === 'Static').length,
      carousel: trends.filter((t) => t.format === 'Carousel').length,
    }
    return NextResponse.json({ success: true, count: trends.length, counts, trends })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
