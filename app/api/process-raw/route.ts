import { NextResponse } from 'next/server'
import { scoreUnprocessedTrends } from '@/lib/scorer'

export const maxDuration = 60

export async function GET() {
  console.log('[process-raw] Scoring unprocessed raw trends')

  try {
    const count = await scoreUnprocessedTrends()
    return NextResponse.json({
      success: true,
      scored: count,
      message: count > 0
        ? `Scored ${count} raw trends — refresh dashboard`
        : 'No unprocessed raw trends found',
    })
  } catch (err) {
    console.error('[process-raw] Error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
