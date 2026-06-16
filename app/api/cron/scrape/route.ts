import { NextResponse } from 'next/server'
import { triggerAllScrapers } from '@/lib/apify'

export async function GET() {
  console.log('[cron/scrape] Starting Apify scraper run')

  // Verify cron secret (Vercel sends CRON_SECRET header in production)
  // For now we rely on the route being internal-only

  try {
    const results = await triggerAllScrapers()
    console.log(`[cron/scrape] Started ${results.length} actor runs`)

    return NextResponse.json({
      success: true,
      message: `Started ${results.length} Apify actor runs`,
      runs: results,
    })
  } catch (err) {
    console.error('[cron/scrape] Failed to trigger scrapers:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
