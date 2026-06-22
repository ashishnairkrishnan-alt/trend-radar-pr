import { NextResponse } from 'next/server'
import { triggerAllScrapers } from '@/lib/apify'

export async function GET() {
  console.log('[cron/scrape] Starting Apify scraper run')

  // Verify cron secret (Vercel sends CRON_SECRET header in production)
  // For now we rely on the route being internal-only

  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'APIFY_API_KEY is not set' }, { status: 500 })
  }

  const errors: string[] = []
  const results = []

  // TikTok
  try {
    const { triggerAllScrapers } = await import('@/lib/apify')
    const runs = await triggerAllScrapers()
    results.push(...runs)
  } catch (err) {
    errors.push(String(err))
    console.error('[cron/scrape] Failed:', err)
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: `Started ${results.length} Apify actor runs`,
    runs: results,
    errors: errors.length ? errors : undefined,
    apify_key_present: !!apiKey,
    apify_key_prefix: apiKey.slice(0, 8) + '...',
  })
}
